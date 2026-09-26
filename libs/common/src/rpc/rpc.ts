import { type ArgumentsHost, Catch, Logger, type RpcExceptionFilter } from '@nestjs/common';
import { type ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom, type Observable, throwError, timeout, TimeoutError } from 'rxjs';
import { AppException, isRpcErrorPayload, rpcError } from '../errors/app.exception.js';
import { ErrorCode } from '../errors/error-codes.js';

/**
 * Gateway → service request/reply. Domain errors come back as AppException
 * (translated by AllExceptionsFilter); a down or slow service becomes
 * SERVICE_UNAVAILABLE instead of hanging the HTTP request.
 */
export async function sendRpc<TResult, TPayload = unknown>(
  client: ClientProxy,
  pattern: string,
  payload: TPayload,
  timeoutMs = 5000,
): Promise<TResult> {
  try {
    return await firstValueFrom(client.send<TResult, TPayload>(pattern, payload).pipe(timeout(timeoutMs)));
  } catch (error) {
    if (isRpcErrorPayload(error)) throw new AppException(error.code, error.args, error.status);
    if (error instanceof TimeoutError) throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
    new Logger('RPC').error(`${pattern} failed: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
    throw new AppException(ErrorCode.SERVICE_UNAVAILABLE);
  }
}

/**
 * Service side: pass domain RpcExceptions through untouched, log anything
 * unexpected and reply with a generic INTERNAL_ERROR so internals never leak.
 */
@Catch()
export class RpcAllExceptionsFilter implements RpcExceptionFilter {
  private readonly logger = new Logger('RpcExceptions');

  catch(exception: unknown, _host: ArgumentsHost): Observable<never> {
    if (exception instanceof RpcException) return throwError(() => exception.getError());
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return throwError(() => rpcError(ErrorCode.INTERNAL_ERROR).getError());
  }
}
