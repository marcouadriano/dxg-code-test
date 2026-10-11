import {
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';
import { z } from 'zod';

import { BaseController } from '../_lib/base.controller.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';
import { NewPasswordSchema } from './password.service.js';
import { TokenService } from './token.service.js';

const REFRESH_COOKIE = 'refresh_token';

function refreshCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    path: '/auth',
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
  };
}

function setRefreshCookie(res: Response, refreshToken: string, ttlInSeconds: number): void {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...refreshCookieOptions(),
    maxAge: ttlInSeconds * 1000,
  });
}

@Controller('auth')
export class AuthController extends BaseController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {
    super();
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const data = this.validate(
      z.object({
        currentPassword: z.string().nonempty(),
        newPassword: NewPasswordSchema,
      }),
      req.body,
    );

    const { accessToken, refreshToken } = await this.authService.changePassword(
      req.auth,
      data.currentPassword,
      data.newPassword,
    );
    setRefreshCookie(res, refreshToken, this.tokenService.refreshTtlInSeconds);

    return { accessToken };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request): Promise<{ accessToken: string }> {
    const refreshToken: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken !== 'string' || refreshToken === '') {
      throw new HttpException(
        { errorCode: 'INVALID_REFRESH_TOKEN', message: 'Your session has expired' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.authService.refresh(refreshToken);
  }

  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const data = this.validate(
      z.object({
        email: z.email(),
        password: z.string().nonempty(),
      }),
      req.body,
    );

    const { accessToken, refreshToken } = await this.authService.signIn(data.email, data.password);
    setRefreshCookie(res, refreshToken, this.tokenService.refreshTtlInSeconds);

    return { accessToken };
  }

  @Post('sign-out')
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const refreshToken: unknown = req.cookies?.[REFRESH_COOKIE];
    if (typeof refreshToken === 'string' && refreshToken !== '') {
      await this.authService.signOut(refreshToken);
    }
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  }

  @Post('sign-out-everywhere')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard)
  async signOutEverywhere(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.signOutEverywhere(req.auth);
    res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  }
}
