import { Injectable, type OnModuleInit } from '@nestjs/common';

import { readPositiveInt } from '../common/env.js';
import { RedisService } from '../common/redis.service.js';

type AttemptScope = 'change-password' | 'sign-in';

const attemptKey = (scope: AttemptScope, id: string) => `auth:attempts:${scope}:${id}`;

@Injectable()
export class AttemptLimitRepository implements OnModuleInit {
  private maxAttempts!: number;
  private windowInSeconds!: number;

  constructor(private readonly redis: RedisService) {}

  onModuleInit(): void {
    this.maxAttempts = readPositiveInt('AUTH_MAX_ATTEMPTS', 5);
    this.windowInSeconds = readPositiveInt('AUTH_ATTEMPT_WINDOW_IN_SECONDS', 15 * 60);
  }

  // Counted before the password is checked, so parallel guesses cannot all slip in under the limit.
  async consume(scope: AttemptScope, id: string): Promise<boolean> {
    const key = attemptKey(scope, id);
    // One transaction, so a counter can never be left without a TTL.
    // NX keeps later attempts from extending the window.
    const results = await this.redis
      .getConnection()
      .multi()
      .incr(key)
      .expire(key, this.windowInSeconds, 'NX')
      .exec();
    // exec() only returns null when a watched key changed, and nothing is watched here.
    if (results === null) throw new Error('Attempt count transaction was aborted');

    const [error, attempts] = results[0];
    if (error) throw error;

    return Number(attempts) <= this.maxAttempts;
  }

  async reset(scope: AttemptScope, id: string): Promise<void> {
    await this.redis.getConnection().del(attemptKey(scope, id));
  }
}
