import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type ClientSession, type CollationOptions, type Db, MongoClient } from 'mongodb';

import { readNonNegativeInt, readPositiveInt } from './env.js';
import { Logger } from './logger.service.js';

// Compares strings ignoring case. Queries must pass the same collation
// to match case-insensitively and to use the email indexes.
export const CASE_INSENSITIVE: CollationOptions = { locale: 'en', strength: 2 };

export const MONGO_DUPLICATE_KEY = 11000;

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private client: MongoClient | null = null;

  constructor(private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    this.initialize();
    await this.connect();
    await this.ensureIndexes();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  getConnection(): Db {
    return this.getClient().db();
  }

  // Needs a replica set; the driver retries fn on transient transaction errors.
  async withTransaction<R>(fn: (session: ClientSession) => Promise<R>): Promise<R> {
    return this.getClient().withSession((session) => session.withTransaction(() => fn(session)));
  }

  private async connect(): Promise<void> {
    await this.getClient().connect();
    await this.getConnection().command({ ping: 1 });
  }

  private async disconnect(): Promise<void> {
    await this.getClient().close();
  }

  private async ensureIndexes(): Promise<void> {
    const db = this.getConnection();
    await Promise.all([
      db
        .collection('employees')
        .createIndex({ email: 1 }, { collation: CASE_INSENSITIVE, unique: true }),
      db
        .collection('credentials')
        .createIndex({ email: 1 }, { collation: CASE_INSENSITIVE, unique: true }),
      db.collection('attendances').createIndex({ employeeId: 1, workDate: 1 }, { unique: true }),
      db.collection('attendances').createIndex({ workDate: 1 }),
    ]);
  }

  private getClient(): MongoClient {
    if (this.client === null) throw new Error('Mongo not initialized');
    return this.client;
  }

  private initialize(): void {
    if (this.client !== null) return;

    const { env } = process;
    if (!env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

    // Number of milliseconds to wait for a reachable server before an operation fails.
    const connTimeoutInMs = readPositiveInt('DATABASE_CONN_TIMEOUT_MS', 30000);

    const maxPoolSize = readPositiveInt('DATABASE_POOL_MAX', 20);
    const minPoolSize = readNonNegativeInt('DATABASE_POOL_MIN', 0);
    if (minPoolSize > maxPoolSize) {
      throw new Error('DATABASE_POOL_MIN must not be greater than DATABASE_POOL_MAX');
    }

    this.client = new MongoClient(env.MONGODB_URI, {
      maxPoolSize,
      minPoolSize,
      serverSelectionTimeoutMS: connTimeoutInMs,
    });

    this.client.on('connectionCreated', () =>
      this.logger.info('A new Mongo connection is created'),
    );
    this.client.on('connectionClosed', () => this.logger.info('A Mongo connection is closed'));
    this.client.on('error', (err: Error) => this.logger.error('A Mongo error has occurred', err));
  }
}
