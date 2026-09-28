import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { STATUS_CODES } from 'node:http';
import type { Request, Response } from 'express';

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  requestId?: string;
}

/**
 * Turns every error into the single shape documented in docs/api.md.
 * Unexpected errors are logged in full but reach the client only as a
 * generic 500, so internals never leak.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const body: ErrorBody = {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message: 'Internal server error',
      requestId: req.id,
    };

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      body.message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ??
            exception.message);
    } else {
      this.logger.error(
        `${req.method} ${req.originalUrl} failed [${req.id}]`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(statusCode).json(body);
  }
}
