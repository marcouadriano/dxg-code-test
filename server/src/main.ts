import { existsSync } from 'node:fs';

import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module.js';
import { uploadDir } from './employee/photo.storage.js';

if (existsSync('.env')) process.loadEnvFile();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.use(cookieParser());
  app.useStaticAssets(uploadDir(), { prefix: '/uploads/' });
  app.enableCors({
    credentials: true,
    // Lets the admin app read the ETag it sends back as If-Match when saving an employee.
    exposedHeaders: ['ETag'],
    origin: process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()) ?? [],
  });

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
