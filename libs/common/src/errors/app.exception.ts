import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ERROR_STATUS, ErrorCode, isErrorCode } from './error-codes.js';

export type ErrorArgs = Record<string, string | number>;

/** Wire format of an error travelling between microservices. */
export type RpcErrorPayload = {
  code: ErrorCode;
  status: number;
  args?: ErrorArgs;
};

/** HTTP-side domain error. Translated by the gateway exception filter. */
export class AppException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    readonly args?: ErrorArgs,
    status: number = ERROR_STATUS[code],
  ) {
    super(code, status);
  }
}

/** Throw from microservice handlers; the gateway turns it back into an AppException. */
export function rpcError(code: ErrorCode, args?: ErrorArgs): RpcException {
  const payload: RpcErrorPayload = { code, status: ERROR_STATUS[code], args };
  return new RpcException(payload);
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    isErrorCode((value as RpcErrorPayload).code) &&
    typeof (value as RpcErrorPayload).status === 'number'
  );
}
