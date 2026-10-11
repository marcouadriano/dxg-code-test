import { HttpException, HttpStatus, Injectable, type OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import type { Attendance, AttendanceWithEmployee } from './attendance.entity.js';
import { AttendanceRepository } from './attendance.repository.js';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const HOUR_IN_MS = 60 * 60 * 1000;
const MAX_SUMMARY_DAYS = 366;

function startOfMonth(date: string): string {
  return `${date.slice(0, 8)}01`;
}

@Injectable()
export class AttendanceService implements OnModuleInit {
  private timezoneOffsetInMs!: number;

  constructor(private readonly attendanceRepository: AttendanceRepository) {}

  onModuleInit(): void {
    const hours = Number(process.env.TIMEZONE_OFFSET ?? 0);
    if (!Number.isFinite(hours) || hours < -12 || hours > 14) {
      throw new Error('TIMEZONE_OFFSET must be a number of hours from -12 to 14');
    }
    this.timezoneOffsetInMs = hours * HOUR_IN_MS;
  }

  async clockIn(employeeId: string): Promise<Attendance> {
    const attendance = await this.attendanceRepository.clockIn({
      clockInAt: Date.now(),
      clockOutAt: null,
      employeeId,
      id: uuidv7(),
      workDate: this.today(),
    });

    if (attendance === null) {
      throw new HttpException(
        {
          errorCode: 'ALREADY_CLOCKED_IN',
          message: 'You have already clocked in today',
        },
        HttpStatus.CONFLICT,
      );
    }

    return attendance;
  }

  async clockOut(employeeId: string): Promise<Attendance> {
    const workDate = this.today();

    const attendance = await this.attendanceRepository.clockOut(employeeId, workDate, Date.now());
    if (attendance === null) {
      const existing = await this.attendanceRepository.findByEmployeeAndDate(employeeId, workDate);

      if (existing === null) {
        throw new HttpException(
          {
            errorCode: 'NOT_CLOCKED_IN',
            message: 'You have not clocked in today',
          },
          HttpStatus.CONFLICT,
        );
      }

      throw new HttpException(
        {
          errorCode: 'ALREADY_CLOCKED_OUT',
          message: 'You have already clocked out today',
        },
        HttpStatus.CONFLICT,
      );
    }

    return attendance;
  }

  async getMySummary(
    employeeId: string,
    props: { from?: string; to?: string },
  ): Promise<{ from: string; items: Attendance[]; to: string }> {
    const { from, to } = this.resolveRange(props);
    // Both ends are included, so the same from and to is one day.
    const dayCount = (Date.parse(to) - Date.parse(from)) / DAY_IN_MS + 1;
    if (dayCount > MAX_SUMMARY_DAYS) {
      throw this.invalidRange(`Date range cannot be longer than ${MAX_SUMMARY_DAYS} days`);
    }

    const items = await this.attendanceRepository.listByEmployee(employeeId, from, to);
    return { from, items, to };
  }

  async list(props: {
    employeeId?: string;
    from?: string;
    page: number;
    pageSize: number;
    to?: string;
  }): Promise<{ items: AttendanceWithEmployee[]; page: number; pageSize: number; total: number }> {
    const { from, to } = this.resolveRange(props);
    const { items, total } = await this.attendanceRepository.list({
      employeeId: props.employeeId,
      from,
      limit: props.pageSize,
      offset: (props.page - 1) * props.pageSize,
      to,
    });
    return { items, page: props.page, pageSize: props.pageSize, total };
  }

  // Defaults to the start of the current month until today.
  private resolveRange(props: { from?: string; to?: string }): { from: string; to: string } {
    const now = this.today();
    const from = props.from ?? startOfMonth(now);
    const to = props.to ?? now;
    if (from > to) {
      throw this.invalidRange('Start date must not be after end date');
    }
    return { from, to };
  }

  private today(): string {
    return new Date(Date.now() + this.timezoneOffsetInMs).toISOString().slice(0, 10);
  }

  private invalidRange(message: string): HttpException {
    return new HttpException({ errorCode: 'INVALID_DATE_RANGE', message }, HttpStatus.BAD_REQUEST);
  }
}
