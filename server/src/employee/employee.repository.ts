import { Injectable } from '@nestjs/common';
import type { ClientSession, Collection, Filter, WithId } from 'mongodb';

import { CASE_INSENSITIVE, MongoService } from '../common/mongo.service.js';
import { type Employee, EmployeeSchema } from './employee.entity.js';

export type EmployeePatch = Partial<Pick<Employee, 'name' | 'phone' | 'position'>>;

type EmployeeDoc = Omit<Employee, 'id'> & { _id: string };

function toEmployee({ _id, ...doc }: WithId<EmployeeDoc>): Employee {
  return EmployeeSchema.parse({ ...doc, id: _id });
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class EmployeeRepository {
  constructor(private readonly db: MongoService) {}

  private collection(): Collection<EmployeeDoc> {
    return this.db.getConnection().collection<EmployeeDoc>('employees');
  }

  async findById(id: string): Promise<Employee | null> {
    const doc = await this.collection().findOne({ _id: id });
    return doc !== null ? toEmployee(doc) : null;
  }

  async list(props: {
    limit: number;
    offset: number;
    search?: string;
  }): Promise<{ items: Employee[]; total: number }> {
    const filter: Filter<EmployeeDoc> = {};
    if (props.search) {
      const pattern = new RegExp(escapeRegex(props.search), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const [docs, total] = await Promise.all([
      this.collection()
        .find(filter)
        .collation(CASE_INSENSITIVE)
        .sort({ name: 1, _id: 1 })
        .skip(props.offset)
        .limit(props.limit)
        .toArray(),
      this.collection().countDocuments(filter),
    ]);
    return { items: docs.map(toEmployee), total };
  }

  async insert(employee: Employee, session?: ClientSession): Promise<Employee> {
    const { id, ...doc } = employee;
    await this.collection().insertOne({ ...doc, _id: id }, { session });
    return employee;
  }

  async update(
    id: string,
    expectedVersion: number,
    patch: EmployeePatch,
    updatedAt: number,
  ): Promise<Employee | null> {
    // Undefined values would be stored as null, so only the given fields are set.
    const set: Partial<EmployeeDoc> = { updatedAt };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.phone !== undefined) set.phone = patch.phone;
    if (patch.position !== undefined) set.position = patch.position;

    const doc = await this.collection().findOneAndUpdate(
      { _id: id, version: expectedVersion },
      { $inc: { version: 1 }, $set: set },
      { returnDocument: 'after' },
    );
    return doc !== null ? toEmployee(doc) : null;
  }

  // Bumps version without checking it, so an admin editing a stale copy gets a conflict.
  async updatePhone(id: string, phone: string, updatedAt: number): Promise<Employee | null> {
    const doc = await this.collection().findOneAndUpdate(
      { _id: id },
      { $inc: { version: 1 }, $set: { phone, updatedAt } },
      { returnDocument: 'after' },
    );
    return doc !== null ? toEmployee(doc) : null;
  }

  async updatePhotoUrl(id: string, photoUrl: string, updatedAt: number): Promise<Employee | null> {
    const doc = await this.collection().findOneAndUpdate(
      { _id: id },
      { $inc: { version: 1 }, $set: { photoUrl, updatedAt } },
      { returnDocument: 'after' },
    );
    return doc !== null ? toEmployee(doc) : null;
  }
}
