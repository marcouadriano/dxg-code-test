import { Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';

import { BaseController } from '../_lib/base.controller.js';
import { AuthGuard } from '../auth/auth.guard.js';
import type { AuthenticatedRequest } from '../auth/auth.types.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import type { Attendance } from './attendance.entity.js';
import { AttendanceService } from './attendance.service.js';

const DateRangeQuery = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});

@Controller('attendances')
@UseGuards(AuthGuard, RolesGuard)
export class AttendanceController extends BaseController {
  constructor(private readonly attendanceService: AttendanceService) {
    super();
  }

  @Get()
  @Roles('admin')
  list(@Req() req: AuthenticatedRequest) {
    const query = this.validate(
      DateRangeQuery.extend({
        employeeId: z.uuid().optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      }),
      req.query,
    );

    return this.attendanceService.list(query);
  }

  @Get('me')
  getMySummary(@Req() req: AuthenticatedRequest) {
    const query = this.validate(DateRangeQuery, req.query);

    return this.attendanceService.getMySummary(req.auth.employeeId, query);
  }

  @Post('clock-in')
  clockIn(@Req() req: AuthenticatedRequest): Promise<Attendance> {
    return this.attendanceService.clockIn(req.auth.employeeId);
  }

  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  clockOut(@Req() req: AuthenticatedRequest): Promise<Attendance> {
    return this.attendanceService.clockOut(req.auth.employeeId);
  }
}
