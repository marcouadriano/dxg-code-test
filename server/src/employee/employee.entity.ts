import { z } from 'zod';

export const EmployeeSchema = z.object({
  createdAt: z.int().nonnegative(),
  createdBy: z.uuid().nullable(),
  email: z.email(),
  id: z.uuid(),
  name: z.string().nonempty(),
  phone: z.string().nonempty().nullable(),
  photoUrl: z.string().nonempty().nullable(),
  position: z.string().nonempty(),
  updatedAt: z.int().nonnegative(),
  version: z.int().nonnegative(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
