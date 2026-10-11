// Creates the first HR admin. Reads ADMIN_EMAIL, ADMIN_PASSWORD and optionally ADMIN_NAME
// from .env or the shell. Run with `pnpm seed:admin`.
import { existsSync } from 'node:fs';

import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

import { CredentialRepository } from './auth/credential.repository.js';
import { NewPasswordSchema, PasswordService } from './auth/password.service.js';
import { Logger } from './common/logger.service.js';
import { MONGO_DUPLICATE_KEY, MongoService } from './common/mongo.service.js';
import { EmployeeRepository } from './employee/employee.repository.js';

if (existsSync('.env')) process.loadEnvFile();

@Module({
  providers: [CredentialRepository, EmployeeRepository, Logger, MongoService, PasswordService],
})
class SeedModule {}

const env = z
  .object({
    ADMIN_EMAIL: z.email(),
    ADMIN_NAME: z.string().nonempty().default('HR Admin'),
    ADMIN_PASSWORD: NewPasswordSchema,
  })
  .parse(process.env);

const app = await NestFactory.createApplicationContext(SeedModule, { logger: ['error', 'warn'] });
try {
  const hashedPassword = await app.get(PasswordService).hash(env.ADMIN_PASSWORD);
  const now = Date.now();
  const id = uuidv7();
  await app.get(MongoService).withTransaction(async (session) => {
    await app.get(EmployeeRepository).insert(
      {
        createdAt: now,
        createdBy: null,
        email: env.ADMIN_EMAIL,
        id,
        name: env.ADMIN_NAME,
        phone: null,
        photoUrl: null,
        position: 'HR',
        updatedAt: now,
        version: 0,
      },
      session,
    );
    await app.get(CredentialRepository).insert(
      {
        createdAt: now,
        email: env.ADMIN_EMAIL,
        employeeId: id,
        hashedPassword,
        role: 'admin',
        tokenGeneration: 0,
        updatedAt: now,
      },
      session,
    );
  });
  console.log(`Created admin ${env.ADMIN_EMAIL}`);
} catch (err: unknown) {
  if ((err as { code?: number }).code !== MONGO_DUPLICATE_KEY) throw err;
  console.error(`${env.ADMIN_EMAIL} is already used`);
  process.exitCode = 1;
} finally {
  await app.close();
}
