import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { z } from 'zod';

// bcrypt ignores everything after the first 72 bytes,
// so longer passwords are rejected rather than silently cut.
export const NewPasswordSchema = z
  .string()
  .min(8)
  .refine((password) => Buffer.byteLength(password) <= 72, 'Password must be at most 72 bytes');

// Compared against when there is no account, so an unknown email takes as long as a wrong password.
// Must use the same cost as hash().
const DUMMY_HASH = '$2b$12$b9Q.bsWPc.iNE8ZW2q5ta.mrsZuf.gsx1KqNezGuNQSGKDMklj6Vq';

@Injectable()
export class PasswordService {
  async compare(password: string, hashedPassword: string | null): Promise<boolean> {
    const matched = await bcrypt.compare(password, hashedPassword ?? DUMMY_HASH);
    return hashedPassword !== null && matched;
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }
}
