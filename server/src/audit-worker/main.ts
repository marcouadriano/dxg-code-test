// Logs every profile change from the Redis stream into a separate Mongo database.
// Runs as its own process, apart from the API: `pnpm start:audit-worker`.
import { existsSync } from 'node:fs';

import { Redis } from 'ioredis';
import { MongoClient } from 'mongodb';

import { Logger } from '../common/logger.service.js';
import { AuditConsumer, type AuditDoc } from './audit-consumer.js';

if (existsSync('.env')) process.loadEnvFile();

const auditUri = process.env.AUDIT_MONGODB_URI;
if (!auditUri) throw new Error('AUDIT_MONGODB_URI is not set');

const logger = new Logger();
logger.initialize();

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.on('error', (err: Error) => logger.error('A redis error has occurred', err));

const mongo = new MongoClient(auditUri);
await mongo.connect();

const consumer = new AuditConsumer(
  mongo.db().collection<AuditDoc>('profile_changes'),
  logger,
  redis,
);
await consumer.start();

// Finishes the current batch, then stops.
process.once('SIGINT', () => consumer.stop());
process.once('SIGTERM', () => consumer.stop());

logger.info('Audit worker started');
try {
  await consumer.run();
} finally {
  redis.disconnect();
  await mongo.close();
}
logger.info('Audit worker stopped');
