import { HttpException, HttpStatus } from '@nestjs/common';
import { z } from 'zod';

export class BaseController {
  protected validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const fields = Object.keys(z.flattenError(parsed.error).fieldErrors);
      const firstField = fields[0] ?? 'form';
      throw new HttpException(
        {
          errorCode: 'INVALID_REQUEST_FORMAT',
          message: `Invalid ${firstField} format`,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return parsed.data;
  }
}
