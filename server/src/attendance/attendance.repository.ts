import { Injectable } from '@nestjs/common';
import type { Collection, Filter, WithId } from 'mongodb';

import { MONGO_DUPLICATE_KEY, MongoService } from '../common/mongo.service.js';
import {
  type Attendance,
  AttendanceSchema,
  type AttendanceWithEmployee,
  AttendanceWithEmployeeSchema,
} from './attendance.entity.js';

// workDate is stored as 'YYYY-MM-DD' text, so string comparison orders it by date.
type AttendanceDoc = Omit<Attendance, 'id'> & { _id: string };
type AttendanceWithEmployeeDoc = WithId<AttendanceDoc> & {
  employee: { email: string; name: string };
};

function toAttendance({ _id, ...doc }: WithId<AttendanceDoc>): Attendance {
  return AttendanceSchema.parse({ ...doc, id: _id });
}

function toAttendanceWithEmployee(doc: AttendanceWithEmployeeDoc): AttendanceWithEmployee {
  const { employee, ...attendance } = doc;
  return AttendanceWithEmployeeSchema.parse({
    ...toAttendance(attendance),
    employeeEmail: employee.email,
    employeeName: employee.name,
  });
}

@Injectable()
export class AttendanceRepository {
  constructor(private readonly db: MongoService) {}

  private collection(): Collection<AttendanceDoc> {
    return this.db.getConnection().collection<AttendanceDoc>('attendances');
  }

  // Returns null when the employee already has a row for that day.
  async clockIn(attendance: Attendance): Promise<Attendance | null> {
    const { id, ...doc } = attendance;
    try {
      await this.collection().insertOne({ ...doc, _id: id });
    } catch (err: unknown) {
      if ((err as { code?: number }).code === MONGO_DUPLICATE_KEY) return null;
      throw err;
    }
    return attendance;
  }

  // Returns null when there is no row for that day or it is already clocked out.
  async clockOut(employeeId: string, workDate: string, now: number): Promise<Attendance | null> {
    const doc = await this.collection().findOneAndUpdate(
      { clockOutAt: null, employeeId, workDate },
      { $set: { clockOutAt: now } },
      { returnDocument: 'after' },
    );
    return doc !== null ? toAttendance(doc) : null;
  }

  async findByEmployeeAndDate(employeeId: string, workDate: string): Promise<Attendance | null> {
    const doc = await this.collection().findOne({ employeeId, workDate });
    return doc !== null ? toAttendance(doc) : null;
  }

  async listByEmployee(employeeId: string, from: string, to: string): Promise<Attendance[]> {
    const docs = await this.collection()
      .find({ employeeId, workDate: { $gte: from, $lte: to } })
      .sort({ workDate: 1 })
      .toArray();
    return docs.map(toAttendance);
  }

  async list(props: {
    employeeId?: string;
    from: string;
    limit: number;
    offset: number;
    to: string;
  }): Promise<{ items: AttendanceWithEmployee[]; total: number }> {
    const filter: Filter<AttendanceDoc> = { workDate: { $gte: props.from, $lte: props.to } };
    if (props.employeeId !== undefined) {
      filter.employeeId = props.employeeId;
    }
    const [docs, total] = await Promise.all([
      this.collection()
        .aggregate<AttendanceWithEmployeeDoc>([
          { $match: filter },
          {
            $lookup: {
              as: 'employee',
              foreignField: '_id',
              from: 'employees',
              localField: 'employeeId',
              pipeline: [{ $project: { _id: 0, email: 1, name: 1 } }],
            },
          },
          { $unwind: '$employee' },
          // Key order is sort priority.
          { $sort: { workDate: -1, 'employee.name': 1, _id: 1 } },
          { $skip: props.offset },
          { $limit: props.limit },
        ])
        .toArray(),
      this.collection().countDocuments(filter),
    ]);
    return { items: docs.map(toAttendanceWithEmployee), total };
  }
}
