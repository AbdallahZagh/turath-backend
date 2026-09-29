import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
  type ValidationError,
} from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { I18nContext, I18nValidationException } from 'nestjs-i18n';
import { AppException, type ErrorArgs } from '../errors/app.exception.js';
import { CommonError, type ErrorDef, errorForStatus, errorMessageKey } from '../errors/error-codes.js';

export type FieldError = { field: string; messages: string[] };

/** The single error shape every endpoint returns. */
export type ErrorResponseBody = {
  statusCode: number;
  code: string;
  message: string;
  errors?: FieldError[];
  path: string;
  timestamp: string;
};

/**
 * Turns every thrown error into a translated `ErrorResponseBody`. The language
 * comes from the request (see i18nOptions), so the same failure reads in
 * Arabic or English depending on the `locale` cookie.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const i18n = I18nContext.current(host);

    const t = (key: string, args?: ErrorArgs): string => (i18n ? (i18n.t(key, { args }) as string) : key);

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: Pick<ErrorDef, 'namespace' | 'code'> = CommonError.INTERNAL_ERROR;
    let args: ErrorArgs | undefined;
    let errors: FieldError[] | undefined;

    if (exception instanceof I18nValidationException) {
      status = HttpStatus.BAD_REQUEST;
      error = CommonError.VALIDATION_FAILED;
      // I18nValidationPipe has already translated each message into the request
      // language (translation args look like `{constraints.0}`).
      errors = flattenValidationErrors(exception.errors, t);
    } else if (exception instanceof AppException) {
      status = exception.getStatus();
      error = exception;
      args = exception.args;
    } else if (exception instanceof ThrottlerException) {
      status = HttpStatus.TOO_MANY_REQUESTS;
      error = CommonError.TOO_MANY_REQUESTS;
      const retryAfter = res.getHeader('Retry-After');
      args = { seconds: Number(retryAfter ?? 60) };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      error = errorForStatus(status);
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    if (status >= 500 && !(exception instanceof AppException)) {
      this.logger.error(
        `${req.method} ${req.url} → ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: ErrorResponseBody = {
      statusCode: status,
      code: error.code,
      message: t(errorMessageKey(error), args),
      ...(errors && { errors }),
      path: req.url,
      timestamp: new Date().toISOString(),
    };
    res.status(status).json(body);
  }
}

/** Errors raised outside our DTO decorators, which carry no i18n key of their own. */
const BUILT_IN_CONSTRAINTS: Record<string, string> = {
  whitelistValidation: 'validation.UNKNOWN_FIELD',
  isUuid: 'validation.ID', // ParseIdPipe on `:id` route params
};

/** Nested DTO errors become dotted paths: `items.0.price`. */
function flattenValidationErrors(errors: ValidationError[], t: (key: string) => string, parent = ''): FieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.entries(error.constraints ?? {}).map(([constraint, message]) =>
      BUILT_IN_CONSTRAINTS[constraint] ? t(BUILT_IN_CONSTRAINTS[constraint]) : message,
    );
    const own: FieldError[] = messages.length ? [{ field, messages }] : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], t, field)];
  });
}
