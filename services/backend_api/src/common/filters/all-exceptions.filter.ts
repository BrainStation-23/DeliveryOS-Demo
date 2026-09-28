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

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger?: Logger) {}

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
      message = exception.message;
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

    response.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
