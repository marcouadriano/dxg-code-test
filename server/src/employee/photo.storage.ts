import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';

import { Logger } from '../common/logger.service.js';

type PhotoType = 'jpg' | 'png' | 'webp';

const PHOTO_URL_PREFIX = '/uploads/photos/';

export function uploadDir(): string {
  return resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function startsWith(buffer: Buffer, signature: Buffer): boolean {
  return buffer.subarray(0, signature.length).equals(signature);
}

// Checks the file's magic bytes; the client's Content-Type and filename are not trusted.
export function detectImageType(buffer: Buffer): PhotoType | null {
  if (startsWith(buffer, JPEG_SIGNATURE)) return 'jpg';
  if (startsWith(buffer, PNG_SIGNATURE)) return 'png';
  // WebP is a RIFF container: "RIFF", then the file size, then "WEBP".
  const riff = buffer.toString('latin1', 0, 4);
  const format = buffer.toString('latin1', 8, 12);
  if (riff === 'RIFF' && format === 'WEBP') return 'webp';
  return null;
}

@Injectable()
export class PhotoStorage implements OnModuleInit {
  private readonly dir = join(uploadDir(), 'photos');

  constructor(private readonly logger: Logger) {}

  async onModuleInit(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async save(buffer: Buffer, type: PhotoType): Promise<string> {
    const filename = `${uuidv7()}.${type}`;
    await writeFile(join(this.dir, filename), buffer);
    return `${PHOTO_URL_PREFIX}${filename}`;
  }

  // Best effort: a file left behind only wastes disk space.
  async remove(photoUrl: string): Promise<void> {
    if (!photoUrl.startsWith(PHOTO_URL_PREFIX)) return;
    try {
      await unlink(join(this.dir, basename(photoUrl)));
    } catch (err: unknown) {
      if ((err as { code?: string }).code === 'ENOENT') return;
      this.logger.error('Failed to remove photo', err as Error);
    }
  }
}
