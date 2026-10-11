import { Injectable } from '@nestjs/common';

import { RedisService } from '../common/redis.service.js';

const sessionKey = (sessionId: string) => `auth:deny:session:${sessionId}`;
const generationKey = (employeeId: string, generation: number) =>
  `auth:deny:gen:${employeeId}:${generation}`;

@Injectable()
export class DenyListRepository {
  constructor(private readonly redis: RedisService) {}

  async add(sessionId: string, ttlInSeconds: number): Promise<void> {
    if (ttlInSeconds <= 0) return;
    await this.redis.getConnection().set(sessionKey(sessionId), '1', 'EX', ttlInSeconds);
  }

  // Generations go up by one per bump, so each bump denies the generation it replaced; the ones
  // before it were denied by earlier bumps. Every bump writes its own key, so concurrent bumps
  // cannot overwrite each other.
  async denyOlderGenerations(
    employeeId: string,
    generation: number,
    ttlInSeconds: number,
  ): Promise<void> {
    await this.redis
      .getConnection()
      .set(generationKey(employeeId, generation - 1), '1', 'EX', ttlInSeconds);
  }

  async isDenied(props: {
    employeeId: string;
    sessionId: string;
    tokenGeneration: number;
  }): Promise<boolean> {
    const [deniedSession, deniedGeneration] = await this.redis
      .getConnection()
      .mget(sessionKey(props.sessionId), generationKey(props.employeeId, props.tokenGeneration));
    return deniedSession !== null || deniedGeneration !== null;
  }
}
