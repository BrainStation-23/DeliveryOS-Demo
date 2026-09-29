import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import type { Logger } from 'winston';
import { requestContext } from '../logging/request-context';

interface ErrorReporter {
  captureException: (exception: unknown, context?: Record<string, unknown>) => string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly logger?: Logger,
    private readonly errorReporter?: ErrorReporter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<{
      method?: string;
      originalUrl?: string;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const resObj = res as Record<string, unknown>;
        const rawMessage = resObj.message;
        message = Array.isArray(rawMessage)
          ? (rawMessage as unknown[]).join(', ')
          : typeof rawMessage === 'string' && rawMessage
            ? rawMessage
            : exception.message;
        error = typeof resObj.error === 'string' && resObj.error ? resObj.error : exception.name;
      }
    } else if (exception instanceof Error) {
      // Never leak internal error details (Prisma/DB/stack traces) to clients;
      // they are already captured in the structured log below.
      message = 'Internal server error';
      error = exception.name;
    }

    const requestId = requestContext.getStore()?.requestId ?? request?.headers?.['x-request-id'];

    if (this.logger) {
      this.logger.error('Unhandled request failure', {
        statusCode: status,
        error,
        message,
        method: request?.method,
        path: request?.originalUrl,
        requestId,
        stack: exception instanceof Error ? exception.stack : undefined,
      });
    }

    // Report unexpected 5xx failures to the error monitor (HttpExceptions are
    // deliberate API outcomes, not bugs)
    if (this.errorReporter && status >= 500 && !(exception instanceof HttpException)) {
      this.errorReporter.captureException(exception, {
        extra: { statusCode: status, path: request?.originalUrl, requestId },
      });
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
