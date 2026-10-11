import { Injectable, type OnModuleInit } from '@nestjs/common';
import winston from 'winston';

type LogMetadata = Record<string, unknown> | Error;

@Injectable()
export class Logger implements OnModuleInit {
  private loggerClient: winston.Logger | null = null;

  onModuleInit(): void {
    this.initialize();
  }

  initialize(): void {
    if (this.loggerClient !== null) return;

    const logLevel = process.env.APP_LOGLEVEL || 'info';
    const name = process.env.APP_NAME || 'service';

    this.loggerClient = winston.createLogger({
      defaultMeta: { service: name },
      format: winston.format.json(),
      level: logLevel,
      transports: [new winston.transports.Console()],
    });
  }

  error(message: string, metadata?: LogMetadata): void {
    this.getClient().error(message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.getClient().warn(message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.getClient().info(message, metadata);
  }

  debug(message: string, metadata?: LogMetadata): void {
    this.getClient().debug(message, metadata);
  }

  private getClient(): winston.Logger {
    if (this.loggerClient === null) throw new Error('Logger is not initialized');
    return this.loggerClient;
  }
}
