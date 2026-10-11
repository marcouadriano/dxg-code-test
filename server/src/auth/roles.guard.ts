import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from './auth.types.js';
import type { Role } from './credential.entity.js';
import { ROLES_KEY } from './roles.decorator.js';

// Must run after AuthGuard, which sets req.auth.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (roles !== undefined && roles.length > 0 && !roles.includes(req.auth.role)) {
      throw new HttpException(
        { errorCode: 'FORBIDDEN', message: 'You are not allowed to do this' },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
