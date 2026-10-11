import { z } from 'zod';

export const RoleSchema = z.enum(['admin', 'user']);

export type Role = z.infer<typeof RoleSchema>;

export const CredentialSchema = z.object({
  createdAt: z.int().nonnegative(),
  email: z.email(),
  employeeId: z.uuid(),
  hashedPassword: z.string().nonempty(),
  role: RoleSchema,
  tokenGeneration: z.int().nonnegative(),
  updatedAt: z.int().nonnegative(),
});

export type Credential = z.infer<typeof CredentialSchema>;
