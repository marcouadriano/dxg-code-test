import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

const MAX_PHOTO_MB = 2;
export const MAX_PHOTO_BYTES = MAX_PHOTO_MB * 1024 * 1024;

// Multer errors surface as Nest's built-in exceptions; reshape them into { errorCode, message }.
@Catch(BadRequestException, PayloadTooLargeException)
export class PhotoUploadFilter implements ExceptionFilter {
  catch(exception: BadRequestException | PayloadTooLargeException, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (exception instanceof PayloadTooLargeException) {
      res.status(HttpStatus.PAYLOAD_TOO_LARGE).json({
        errorCode: 'PHOTO_TOO_LARGE',
        message: `Photo must be ${MAX_PHOTO_MB} MB or smaller`,
      });
      return;
    }
    res.status(HttpStatus.BAD_REQUEST).json({
      errorCode: 'INVALID_REQUEST_FORMAT',
      message: 'Invalid photo format',
    });
  }
}
