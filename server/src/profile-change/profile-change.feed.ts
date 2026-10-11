import { setTimeout as sleep } from 'node:timers/promises';

import { Injectable, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { Subject } from 'rxjs';

import { Logger } from '../common/logger.service.js';
import { RedisService } from '../common/redis.service.js';
import {
  PROFILE_CHANGES_STREAM,
  type ProfileChange,
  toProfileChange,
} from './profile-change.entity.js';

type ProfileChangeEvent = ProfileChange & { id: string };

// Reads new profile changes from the stream once per process and hands them to every listener.
@Injectable()
export class ProfileChangeFeed implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly subject = new Subject<ProfileChangeEvent>();
  readonly changes$ = this.subject.asObservable();

  private connection: Redis | null = null;
  private reading: Promise<void> | null = null;
  private running = false;

  constructor(
    private readonly logger: Logger,
    private readonly redis: RedisService,
  ) {}

  // Runs after every onModuleInit, so the main Redis connection exists by now.
  onApplicationBootstrap(): void {
    // XREAD BLOCK holds its connection while it waits, so the feed gets its own.
    this.connection = this.redis.getConnection().duplicate();
    this.running = true;
    this.reading = this.read(this.connection);
  }

  async onModuleDestroy(): Promise<void> {
    this.running = false;
    this.connection?.disconnect();
    await this.reading;
    this.subject.complete();
  }

  private async read(connection: Redis): Promise<void> {
    // '$' means only changes published from now on; after that, continue from the last one seen.
    let lastId = '$';
    while (this.running) {
      try {
        const reply = await connection.xread(
          'COUNT',
          100,
          'BLOCK',
          5000,
          'STREAMS',
          PROFILE_CHANGES_STREAM,
          lastId,
        );
        for (const [, entries] of reply ?? []) {
          for (const [id, fields] of entries) {
            lastId = id;
            this.emit(id, fields);
          }
        }
      } catch (err: unknown) {
        if (!this.running) return;
        this.logger.error('Failed to read profile changes, retrying in 1s', err as Error);
        await sleep(1000);
      }
    }
  }

  private emit(id: string, fields: string[]): void {
    try {
      this.subject.next({ ...toProfileChange(fields), id });
    } catch (err: unknown) {
      this.logger.error(`Skipped invalid profile change ${id}`, err as Error);
    }
  }
}
