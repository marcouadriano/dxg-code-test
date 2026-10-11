import { Module } from '@nestjs/common';

import { ProfileChangeModule } from '../profile-change/profile-change.module.js';
import { AttemptLimitRepository } from './attempt-limit.repository.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { CredentialRepository } from './credential.repository.js';
import { DenyListRepository } from './deny-list.repository.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

@Module({
  controllers: [AuthController],
  exports: [AuthService, TokenService],
  imports: [ProfileChangeModule],
  providers: [
    AttemptLimitRepository,
    AuthService,
    CredentialRepository,
    DenyListRepository,
    PasswordService,
    TokenService,
  ],
})
export class AuthModule {}
