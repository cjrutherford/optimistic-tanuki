import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * Gives a microservice's answer the status it asked for.
 *
 * The gateway had no filter, so everything a service threw arrived as a 500.
 * A caller reaching a project they have no access to was told the server had
 * broken rather than that they were not allowed, and two reviewers racing to
 * approve the same change both saw a fault instead of "somebody already
 * decided this". The services were saying the right thing and nothing was
 * listening.
 *
 * Two shapes arrive over TCP. RpcException carries { statusCode, message },
 * which is the convention in project-planning's access helpers. Nest's HTTP
 * exceptions serialize to { status, message } when thrown inside a
 * microservice. Both are honoured, and anything else stays a 500, because an
 * error nobody classified is a fault until somebody says otherwise.
 */
@Catch()
export class MicroserviceExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(MicroserviceExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(toBody(exception.getResponse(), status));
      return;
    }

    const status = statusFrom(exception);
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      // Only the ones that really are faults. Logging a 403 as an error turns
      // the log into noise and hides the ones that matter.
      this.logger.error(
        `Unhandled: ${(exception as Error)?.message ?? exception}`
      );
    }

    response.status(status).json(toBody(messageFrom(exception), status));
  }
}

function statusFrom(exception: unknown): number {
  const carried = exception as {
    statusCode?: unknown;
    status?: unknown;
    error?: { statusCode?: unknown; status?: unknown };
  };
  const candidate =
    carried?.statusCode ??
    carried?.status ??
    carried?.error?.statusCode ??
    carried?.error?.status;

  return typeof candidate === 'number' && candidate >= 400 && candidate <= 599
    ? candidate
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function messageFrom(exception: unknown): unknown {
  const carried = exception as {
    message?: unknown;
    error?: { message?: unknown };
  };
  return (
    carried?.message ??
    carried?.error?.message ??
    'Something went wrong handling that request'
  );
}

function toBody(message: unknown, status: number): Record<string, unknown> {
  if (message && typeof message === 'object' && 'message' in message) {
    return message as Record<string, unknown>;
  }
  return { statusCode: status, message };
}
