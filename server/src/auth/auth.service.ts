import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { ClientSession } from 'mongodb';

import { ProfileChangePublisher } from '../profile-change/profile-change.publisher.js';
import { AttemptLimitRepository } from './attempt-limit.repository.js';
import type { AuthContext } from './auth.types.js';
import type { Role } from './credential.entity.js';
import { CredentialRepository } from './credential.repository.js';
import { DenyListRepository } from './deny-list.repository.js';
import { PasswordService } from './password.service.js';
import { type RefreshPayload, TokenService } from './token.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly attemptLimitRepository: AttemptLimitRepository,
    private readonly credentialRepository: CredentialRepository,
    private readonly denyListRepository: DenyListRepository,
    private readonly passwordService: PasswordService,
    private readonly profileChangePublisher: ProfileChangePublisher,
    private readonly tokenService: TokenService,
  ) {}

  async authenticate(accessToken: string): Promise<AuthContext> {
    const payload = this.tokenService.verifyAccessToken(accessToken);
    if (await this.denyListRepository.isDenied(payload)) {
      throw this.sessionExpired();
    }

    return {
      employeeId: payload.employeeId,
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }

  async changePassword(
    auth: AuthContext,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const credential = await this.credentialRepository.findByEmployeeId(auth.employeeId);
    if (credential === null) {
      throw this.sessionExpired();
    }

    if (newPassword === currentPassword) {
      throw new HttpException(
        {
          errorCode: 'SAME_PASSWORD',
          message: 'Your new password must be different from the current one',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!(await this.attemptLimitRepository.consume('change-password', auth.employeeId))) {
      throw this.tooManyAttempts();
    }

    if (!(await this.passwordService.compare(currentPassword, credential.hashedPassword))) {
      throw new HttpException(
        {
          errorCode: 'INCORRECT_CURRENT_PASSWORD',
          message: 'Your current password is incorrect',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.attemptLimitRepository.reset('change-password', auth.employeeId);

    const updated = await this.credentialRepository.updatePassword(
      auth.employeeId,
      credential.tokenGeneration,
      await this.passwordService.hash(newPassword),
      Date.now(),
    );
    if (updated === null) {
      throw this.sessionExpired();
    }

    await this.denyListRepository.denyOlderGenerations(
      updated.employeeId,
      updated.tokenGeneration,
      this.tokenService.refreshTtlInSeconds,
    );
    await this.profileChangePublisher.publish({
      change: 'password',
      changedAt: updated.updatedAt,
      email: updated.email,
      employeeId: updated.employeeId,
    });

    const refreshToken = this.tokenService.generateRefreshToken(updated);
    const accessToken = this.tokenService.generateAccessToken(updated, refreshToken);

    return { accessToken, refreshToken };
  }

  async createCredential(
    session: ClientSession,
    props: { email: string; employeeId: string; password: string; role: Role },
  ): Promise<void> {
    const now = Date.now();
    await this.credentialRepository.insert(
      {
        createdAt: now,
        email: props.email,
        employeeId: props.employeeId,
        hashedPassword: await this.passwordService.hash(props.password),
        role: props.role,
        tokenGeneration: 0,
        updatedAt: now,
      },
      session,
    );
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    const payload = this.tokenService.verifyRefreshToken(refreshToken);
    if (await this.denyListRepository.isDenied(payload)) {
      throw this.sessionExpired();
    }

    const credential = await this.credentialRepository.findByEmployeeId(payload.employeeId);
    if (credential === null || credential.tokenGeneration !== payload.tokenGeneration) {
      throw this.sessionExpired();
    }

    return { accessToken: this.tokenService.generateAccessToken(credential, refreshToken) };
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Emails are case-insensitive, so every casing shares one counter.
    const attemptId = email.toLowerCase();
    if (!(await this.attemptLimitRepository.consume('sign-in', attemptId))) {
      throw this.tooManyAttempts();
    }

    const credential = await this.credentialRepository.findByEmail(email);
    const matched = await this.passwordService.compare(
      password,
      credential?.hashedPassword ?? null,
    );

    if (credential === null || !matched) {
      throw new HttpException(
        {
          errorCode: 'INCORRECT_PASSWORD',
          message: 'Your email and password are not matched',
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
    await this.attemptLimitRepository.reset('sign-in', attemptId);

    const refreshToken = this.tokenService.generateRefreshToken(credential);
    const accessToken = this.tokenService.generateAccessToken(credential, refreshToken);

    return { accessToken, refreshToken };
  }

  async signOut(refreshToken: string): Promise<void> {
    let payload: RefreshPayload;
    try {
      payload = this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    const ttlInSeconds = payload.expiresAt - Math.floor(Date.now() / 1000);
    await this.denyListRepository.add(payload.sessionId, ttlInSeconds);
  }

  async signOutEverywhere(auth: AuthContext): Promise<void> {
    const updated = await this.credentialRepository.bumpTokenGeneration(
      auth.employeeId,
      Date.now(),
    );
    if (updated === null) {
      throw this.sessionExpired();
    }

    await this.denyListRepository.denyOlderGenerations(
      updated.employeeId,
      updated.tokenGeneration,
      this.tokenService.refreshTtlInSeconds,
    );
  }

  private sessionExpired(): HttpException {
    return new HttpException(
      {
        errorCode: 'SESSION_EXPIRED',
        message: 'Your session has expired, please sign in again',
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  private tooManyAttempts(): HttpException {
    return new HttpException(
      {
        errorCode: 'TOO_MANY_ATTEMPTS',
        message: 'Too many attempts, please try again later',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
