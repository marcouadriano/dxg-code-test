import { z } from 'zod';

export const PROFILE_CHANGES_STREAM = 'profile-changes';

const ProfileChangeSchema = z.object({
  change: z.enum(['password', 'phone', 'photo']),
  changedAt: z.coerce.number().int().nonnegative(),
  email: z.email(),
  employeeId: z.uuid(),
});

export type ProfileChange = z.infer<typeof ProfileChangeSchema>;

// Redis returns a stream entry's fields as one flat [key, value, key, value, ...] list.
export function toProfileChange(fields: string[]): ProfileChange {
  const record: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    record[fields[i]] = fields[i + 1];
  }
  return ProfileChangeSchema.parse(record);
}
