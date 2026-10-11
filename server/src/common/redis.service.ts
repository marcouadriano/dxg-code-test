import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

import { Logger } from './logger.service.js';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis | null = null;

  constructor(private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      lazyConnect: true,
    });
    this.client.on('error', (err: Error) => this.logger.error('A redis error has occurred', err));
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.getConnection().quit();
  }

  getConnection(): Redis {
    if (this.client === null) throw new Error('Redis not initialized');
    return this.client;
  }
}
