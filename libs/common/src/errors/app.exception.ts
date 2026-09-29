import { HttpException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { ErrorDef } from './error-codes.js';

export type ErrorArgs = Record<string, string | number>;

/** Wire format of an error travelling between microservices. */
export type RpcErrorPayload = {
  code: string;
  namespace: string;
  status: number;
  args?: ErrorArgs;
};

/** HTTP-side domain error. Translated by the gateway exception filter. */
export class AppException extends HttpException {
  readonly code: string;
  readonly namespace: string;

  constructor(
    error: ErrorDef,
    readonly args?: ErrorArgs,
  ) {
    super(error.code, error.status);
    this.code = error.code;
    this.namespace = error.namespace;
  }
}

/** Throw from microservice handlers; the gateway turns it back into an AppException. */
export function rpcError(error: ErrorDef, args?: ErrorArgs): RpcException {
  const payload: RpcErrorPayload = { code: error.code, namespace: error.namespace, status: error.status, args };
  return new RpcException(payload);
}

export function isRpcErrorPayload(value: unknown): value is RpcErrorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const { code, namespace, status } = value as Partial<RpcErrorPayload>;
  return typeof code === 'string' && typeof namespace === 'string' && typeof status === 'number';
}
