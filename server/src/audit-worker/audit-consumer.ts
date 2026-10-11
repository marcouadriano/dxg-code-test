import { setTimeout as sleep } from 'node:timers/promises';

import type { Redis } from 'ioredis';
import type { Collection } from 'mongodb';

import type { Logger } from '../common/logger.service.js';
import { MONGO_DUPLICATE_KEY } from '../common/mongo.service.js';
import {
  PROFILE_CHANGES_STREAM,
  type ProfileChange,
  toProfileChange,
} from '../profile-change/profile-change.entity.js';

const AUDIT_GROUP = 'audit-log';
const CONSUMER = 'audit-worker';

// The stream entry id is the _id, so an entry delivered twice is only stored once.
export type AuditDoc = ProfileChange & { _id: string; loggedAt: number };

type StreamReply = [stream: string, entries: [id: string, fields: string[]][]][] | null;

export class AuditConsumer {
  private running = true;

  constructor(
    private readonly logs: Collection<AuditDoc>,
    private readonly logger: Logger,
    private readonly redis: Redis,
  ) {}

  async start(): Promise<void> {
    await this.logs.createIndex({ employeeId: 1, changedAt: -1 });
    try {
      // From 0, so changes published before the group existed are logged too.
      await this.redis.xgroup('CREATE', PROFILE_CHANGES_STREAM, AUDIT_GROUP, '0', 'MKSTREAM');
    } catch (err: unknown) {
      const alreadyExists = err instanceof Error && err.message.startsWith('BUSYGROUP');
      if (!alreadyExists) throw err;
    }
  }

  stop(): void {
    this.running = false;
  }

  async run(): Promise<void> {
    // '0' rereads entries this worker received but never acknowledged (it crashed or stopped
    // midway); once those are done, '>' waits for new ones.
    let cursor = '0';
    while (this.running) {
      try {
        const entries = await this.read(cursor);
        if (cursor === '0' && entries.length === 0) {
          cursor = '>';
          continue;
        }
        for (const [id, fields] of entries) {
          await this.handle(id, fields);
        }
      } catch (err: unknown) {
        this.logger.error('Failed to log profile changes, retrying in 5s', err as Error);
        cursor = '0';
        await sleep(5000);
      }
    }
  }

  private async handle(id: string, fields: string[]): Promise<void> {
    let change: ProfileChange;
    try {
      change = toProfileChange(fields);
    } catch (err: unknown) {
      // Acknowledged anyway, so one bad entry cannot block the queue forever.
      this.logger.error(`Skipped invalid profile change ${id}`, err as Error);
      await this.acknowledge(id);
      return;
    }

    try {
      await this.logs.insertOne({ ...change, _id: id, loggedAt: Date.now() });
    } catch (err: unknown) {
      // A duplicate means an earlier delivery was stored but not acknowledged.
      if ((err as { code?: number }).code !== MONGO_DUPLICATE_KEY) throw err;
    }
    await this.acknowledge(id);
  }

  private async read(cursor: string): Promise<[id: string, fields: string[]][]> {
    const reply = (await this.redis.xreadgroup(
      'GROUP',
      AUDIT_GROUP,
      CONSUMER,
      'COUNT',
      100,
      'BLOCK',
      5000,
      'STREAMS',
      PROFILE_CHANGES_STREAM,
      cursor,
    )) as StreamReply;
    return reply?.[0]?.[1] ?? [];
  }

  private async acknowledge(id: string): Promise<void> {
    await this.redis.xack(PROFILE_CHANGES_STREAM, AUDIT_GROUP, id);
  }
}
