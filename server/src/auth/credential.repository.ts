import { Injectable } from '@nestjs/common';
import type { ClientSession, Collection, WithId } from 'mongodb';

import { CASE_INSENSITIVE, MongoService } from '../common/mongo.service.js';
import { type Credential, CredentialSchema } from './credential.entity.js';

type CredentialDoc = Omit<Credential, 'employeeId'> & { _id: string };

function toCredential({ _id, ...doc }: WithId<CredentialDoc>): Credential {
  return CredentialSchema.parse({ ...doc, employeeId: _id });
}

@Injectable()
export class CredentialRepository {
  constructor(private readonly db: MongoService) {}

  private collection(): Collection<CredentialDoc> {
    return this.db.getConnection().collection<CredentialDoc>('credentials');
  }

  async findByEmail(email: string): Promise<Credential | null> {
    const doc = await this.collection().findOne({ email }, { collation: CASE_INSENSITIVE });
    return doc !== null ? toCredential(doc) : null;
  }

  async findByEmployeeId(employeeId: string): Promise<Credential | null> {
    const doc = await this.collection().findOne({ _id: employeeId });
    return doc !== null ? toCredential(doc) : null;
  }

  async bumpTokenGeneration(employeeId: string, now: number): Promise<Credential | null> {
    const doc = await this.collection().findOneAndUpdate(
      { _id: employeeId },
      { $inc: { tokenGeneration: 1 }, $set: { updatedAt: now } },
      { returnDocument: 'after' },
    );
    return doc !== null ? toCredential(doc) : null;
  }

  // Bumping the token generation in the same update ends every older session.
  // Matching on the generation that was read makes a concurrent change lose instead of overwrite.
  async updatePassword(
    employeeId: string,
    expectedGeneration: number,
    hashedPassword: string,
    now: number,
  ): Promise<Credential | null> {
    const doc = await this.collection().findOneAndUpdate(
      { _id: employeeId, tokenGeneration: expectedGeneration },
      { $inc: { tokenGeneration: 1 }, $set: { hashedPassword, updatedAt: now } },
      { returnDocument: 'after' },
    );
    return doc !== null ? toCredential(doc) : null;
  }

  async insert(credential: Credential, session?: ClientSession): Promise<void> {
    const { employeeId, ...doc } = credential;
    await this.collection().insertOne({ ...doc, _id: employeeId }, { session });
  }
}
