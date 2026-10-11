import { z } from 'zod';

export const AttendanceSchema = z.object({
  clockInAt: z.int().nonnegative(),
  clockOutAt: z.int().nonnegative().nullable(),
  employeeId: z.uuid(),
  id: z.uuid(),
  workDate: z.iso.date(),
});

export type Attendance = z.infer<typeof AttendanceSchema>;

export const AttendanceWithEmployeeSchema = AttendanceSchema.extend({
  employeeEmail: z.email(),
  employeeName: z.string().nonempty(),
});

export type AttendanceWithEmployee = z.infer<typeof AttendanceWithEmployeeSchema>;
