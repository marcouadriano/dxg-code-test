import { HttpException, HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

import { readPositiveInt } from '../common/env.js';
import { type Credential, type Role, RoleSchema } from './credential.entity.js';

const AlgorithmSchema = z.enum(['ES256', 'PS256', 'RS256']);

const AccessClaims = z.object({
  exp: z.int().nonnegative(),
  gen: z.int().nonnegative(),
  role: RoleSchema,
  sessionId: z.uuid(),
  sub: z.uuid(),
});

const RefreshClaims = z.object({
  exp: z.int().nonnegative(),
  gen: z.int().nonnegative(),
  jti: z.uuid(),
  sub: z.uuid(),
});

type AccessPayload = {
  employeeId: string;
  role: Role;
  sessionId: string;
  tokenGeneration: number;
};

export type RefreshPayload = {
  employeeId: string;
  expiresAt: number;
  sessionId: string;
  tokenGeneration: number;
};

function readKey(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  // Allow PEM keys stored on one line in .env with literal "\n".
  return value.replace(/\\n/g, '\n');
}

@Injectable()
export class TokenService implements OnModuleInit {
  accessTtlInSeconds!: number;
  refreshTtlInSeconds!: number;
  private accessAudience!: string;
  private algorithm!: z.infer<typeof AlgorithmSchema>;
  private issuer!: string;
  private keyId!: string;
  private privateKey!: string;
  private publicKey!: string;
  private refreshAudience!: string;

  onModuleInit(): void {
    this.accessAudience = process.env.JWT_ACCESS_AUDIENCE ?? 'server/*';
    this.accessTtlInSeconds = readPositiveInt('JWT_ACCESS_TTL_IN_SECONDS', 15 * 60);
    const algorithm = AlgorithmSchema.safeParse(process.env.JWT_ALGORITHM ?? 'ES256');
    if (!algorithm.success) {
      throw new Error(`JWT_ALGORITHM must be one of ${AlgorithmSchema.options.join(', ')}`);
    }
    this.algorithm = algorithm.data;
    this.issuer = process.env.JWT_ISSUER ?? 'server/auth';
    this.keyId = readKey('JWT_KEY_ID');
    this.privateKey = readKey('JWT_PRIVATE_KEY');
    this.publicKey = readKey('JWT_PUBLIC_KEY');
    this.refreshAudience = process.env.JWT_REFRESH_AUDIENCE ?? 'server/auth';
    this.refreshTtlInSeconds = readPositiveInt('JWT_REFRESH_TTL_IN_SECONDS', 6 * 60 * 60);
    // The audience is all that tells the two token types apart.
    if (this.accessAudience === this.refreshAudience) {
      throw new Error('JWT_ACCESS_AUDIENCE and JWT_REFRESH_AUDIENCE must be different');
    }

    // Fail at startup, not on the first sign-in, when the two keys do not match.
    const probe = jwt.sign({}, this.privateKey, { algorithm: this.algorithm });
    try {
      jwt.verify(probe, this.publicKey, { algorithms: [this.algorithm] });
    } catch {
      throw new Error('JWT_PUBLIC_KEY does not belong to JWT_PRIVATE_KEY');
    }
  }

  generateAccessToken(credential: Credential, refreshToken: string): string {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    const payload = this.verifyRefreshToken(refreshToken);

    return jwt.sign(
      {
        exp: Math.min(nowInSeconds + this.accessTtlInSeconds, payload.expiresAt),
        gen: payload.tokenGeneration,
        role: credential.role,
        sessionId: payload.sessionId,
      },
      this.privateKey,
      {
        algorithm: this.algorithm,
        audience: this.accessAudience,
        issuer: this.issuer,
        jwtid: uuidv7(),
        keyid: this.keyId,
        subject: payload.employeeId,
      },
    );
  }

  generateRefreshToken(credential: Credential): string {
    const nowInSeconds = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        exp: nowInSeconds + this.refreshTtlInSeconds,
        gen: credential.tokenGeneration,
      },
      this.privateKey,
      {
        algorithm: this.algorithm,
        audience: this.refreshAudience,
        issuer: this.issuer,
        jwtid: uuidv7(),
        keyid: this.keyId,
        subject: credential.employeeId,
      },
    );
  }

  verifyAccessToken(token: string): AccessPayload {
    const claims = this.verify(token, this.accessAudience, AccessClaims, {
      errorCode: 'INVALID_ACCESS_TOKEN',
      message: 'Your session is invalid, please sign in again',
    });
    return {
      employeeId: claims.sub,
      role: claims.role,
      sessionId: claims.sessionId,
      tokenGeneration: claims.gen,
    };
  }

  verifyRefreshToken(token: string): RefreshPayload {
    const claims = this.verify(token, this.refreshAudience, RefreshClaims, {
      errorCode: 'INVALID_REFRESH_TOKEN',
      message: 'Your session has expired',
    });
    return {
      employeeId: claims.sub,
      expiresAt: claims.exp,
      sessionId: claims.jti,
      tokenGeneration: claims.gen,
    };
  }

  private verify<T extends z.ZodType>(
    token: string,
    audience: string,
    schema: T,
    error: { errorCode: string; message: string },
  ): z.infer<T> {
    try {
      const payload = jwt.verify(token, this.publicKey, {
        algorithms: [this.algorithm],
        audience,
        issuer: this.issuer,
      });
      return schema.parse(payload);
    } catch {
      throw new HttpException(error, HttpStatus.UNAUTHORIZED);
    }
  }
}
