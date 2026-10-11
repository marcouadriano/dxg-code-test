import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  type MessageEvent,
  Patch,
  Post,
  Put,
  Req,
  Res,
  Sse,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { map, type Observable, takeUntil, timer } from 'rxjs';
import { z } from 'zod';

import { BaseController } from '../_lib/base.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { RoleSchema } from '../auth/credential.entity.js';
import { NewPasswordSchema } from '../auth/password.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { TokenService } from '../auth/token.service.js';
import { ProfileChangeFeed } from '../profile-change/profile-change.feed.js';
import type { Employee } from './employee.entity.js';
import { EmployeeService } from './employee.service.js';
import { MAX_PHOTO_BYTES, PhotoUploadFilter } from './photo-upload.filter.js';

const IdParams = z.object({ id: z.uuid() });

type UploadedPhoto = { buffer: Buffer };

type EmployeeResponse = Omit<Employee, 'version'>;

// The version is sent as the ETag header instead of in the body.
function toResponse({ version: _version, ...employee }: Employee): EmployeeResponse {
  return employee;
}

function setETag(res: Response, employee: Employee): void {
  res.setHeader('ETag', `"${employee.version}"`);
}

// Only a single strong ETag can match, since If-Match uses strong comparison.
function parseIfMatch(header: string | undefined): number {
  if (header === undefined) {
    throw new HttpException(
      {
        errorCode: 'PRECONDITION_REQUIRED',
        message: 'If-Match header is required, reload and try again',
      },
      HttpStatus.PRECONDITION_REQUIRED,
    );
  }

  const match = /^"(\d+)"$/.exec(header.trim());
  if (match === null) {
    throw new HttpException(
      {
        errorCode: 'PRECONDITION_FAILED',
        message: 'If-Match must be a single ETag from this API',
      },
      HttpStatus.PRECONDITION_FAILED,
    );
  }
  return Number(match[1]);
}

@Controller('employees')
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin')
export class EmployeeController extends BaseController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly profileChangeFeed: ProfileChangeFeed,
    private readonly tokenService: TokenService,
  ) {
    super();
  }

  @Get()
  async list(@Req() req: Request) {
    const query = this.validate(
      z.object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        search: z.string().trim().optional(),
      }),
      req.query,
    );

    const page = await this.employeeService.list(query);
    return { ...page, items: page.items.map(toResponse) };
  }

  // Declared before the ':id' routes so 'profile-changes' is not matched as an id.
  // The token is only checked when the stream opens, so the stream ends when an access token
  // would expire and the client reconnects with a fresh one.
  @Sse('profile-changes')
  profileChanges(): Observable<MessageEvent> {
    const tokenLifetime = timer(this.tokenService.accessTtlInSeconds * 1000);
    return this.profileChangeFeed.changes$.pipe(
      map((change) => ({ data: change, id: change.id })),
      takeUntil(tokenLifetime),
    );
  }

  // Declared before the ':id' routes so 'me' is not matched as an id.
  @Get('me')
  @Roles('admin', 'user')
  async getMe(@Req() req: AuthenticatedRequest): Promise<EmployeeResponse> {
    return toResponse(await this.employeeService.getById(req.auth.employeeId));
  }

  @Patch('me')
  @Roles('admin', 'user')
  async updateMe(@Req() req: AuthenticatedRequest): Promise<EmployeeResponse> {
    const { phone } = this.validate(
      z.object({
        phone: z.string().trim().nonempty(),
      }),
      req.body,
    );

    return toResponse(await this.employeeService.updatePhone(req.auth.employeeId, phone));
  }

  @Put('me/photo')
  @Roles('admin', 'user')
  @UseFilters(PhotoUploadFilter)
  @UseInterceptors(FileInterceptor('photo', { limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } }))
  async updateMyPhoto(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() photo: UploadedPhoto | undefined,
  ): Promise<EmployeeResponse> {
    if (photo === undefined) {
      throw new HttpException(
        { errorCode: 'INVALID_REQUEST_FORMAT', message: 'Invalid photo format' },
        HttpStatus.BAD_REQUEST,
      );
    }

    return toResponse(await this.employeeService.updatePhoto(req.auth.employeeId, photo));
  }

  @Get(':id')
  async findOne(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmployeeResponse> {
    const { id } = this.validate(IdParams, req.params);

    const employee = await this.employeeService.getById(id);
    setETag(res, employee);
    return toResponse(employee);
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmployeeResponse> {
    const data = this.validate(
      z.object({
        email: z.email(),
        name: z.string().trim().nonempty(),
        password: NewPasswordSchema,
        phone: z.string().trim().nonempty().optional(),
        position: z.string().trim().nonempty(),
        role: RoleSchema.default('user'),
      }),
      req.body,
    );

    const employee = await this.employeeService.create(data, req.auth.employeeId);
    setETag(res, employee);
    return toResponse(employee);
  }

  @Patch(':id')
  async updateOne(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EmployeeResponse> {
    const { id } = this.validate(IdParams, req.params);
    const version = parseIfMatch(req.headers['if-match']);
    const patch = this.validate(
      z
        .object({
          name: z.string().trim().nonempty().optional(),
          phone: z.string().trim().nonempty().nullable().optional(),
          position: z.string().trim().nonempty().optional(),
        })
        .refine(
          (data) =>
            data.name !== undefined || data.phone !== undefined || data.position !== undefined,
        ),
      req.body,
    );

    const employee = await this.employeeService.update(id, version, patch);
    setETag(res, employee);
    return toResponse(employee);
  }
}
