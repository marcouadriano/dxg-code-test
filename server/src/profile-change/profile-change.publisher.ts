import { Injectable } from '@nestjs/common';

import { Logger } from '../common/logger.service.js';
import { RedisService } from '../common/redis.service.js';
import { PROFILE_CHANGES_STREAM, type ProfileChange } from './profile-change.entity.js';

// Old entries are trimmed so the stream cannot grow forever.
const MAX_STREAM_LENGTH = 10000;

@Injectable()
export class ProfileChangePublisher {
  constructor(
    private readonly logger: Logger,
    private readonly redis: RedisService,
  ) {}

  // The change is already saved, so a failed publish is logged instead of failing the request.
  async publish(change: ProfileChange): Promise<void> {
    try {
      await this.redis
        .getConnection()
        .xadd(
          PROFILE_CHANGES_STREAM,
          'MAXLEN',
          '~',
          MAX_STREAM_LENGTH,
          '*',
          'change',
          change.change,
          'changedAt',
          change.changedAt,
          'email',
          change.email,
          'employeeId',
          change.employeeId,
        );
    } catch (err: unknown) {
      this.logger.error('Failed to publish a profile change', err as Error);
    }
  }
}
