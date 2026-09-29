import { type ErrorDef, rpcError } from '@turath/common';
import { Observable, throwError } from 'rxjs';

type Handler = (payload: any) => unknown;

/**
 * Stands in for a RabbitMQ ClientProxy in gateway tests. Script replies per
 * message pattern, then assert on what the gateway sent:
 *
 *   identity.reply(IdentityPatterns.REGISTER, () => otpDispatch());
 *   identity.fail(IdentityPatterns.LOGIN_EMAIL, IdentityError.INVALID_CREDENTIALS);
 *   expect(identity.lastPayload(IdentityPatterns.REGISTER)).toMatchObject({ ... });
 *
 * An unscripted pattern fails loudly, like a service that doesn't answer.
 */
export class FakeClientProxy {
  readonly sent: { pattern: string; payload: unknown }[] = [];
  private readonly handlers = new Map<string, Handler>();

  reply(pattern: string, handler: Handler): this {
    this.handlers.set(pattern, handler);
    return this;
  }

  /** Reply with a domain error, exactly as a service's `rpcError(code)` would. */
  fail(pattern: string, code: ErrorDef, args?: Record<string, string | number>): this {
    return this.reply(pattern, () => {
      throw rpcError(code, args).getError();
    });
  }

  lastPayload<T = any>(pattern: string): T | undefined {
    return [...this.sent].reverse().find((message) => message.pattern === pattern)?.payload as T | undefined;
  }

  reset(): void {
    this.sent.length = 0;
    this.handlers.clear();
  }

  // ── the parts of ClientProxy the gateway uses ──
  connect(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  send<T>(pattern: string, payload: unknown): Observable<T> {
    this.sent.push({ pattern, payload });
    const handler = this.handlers.get(pattern);
    if (!handler) return throwError(() => new Error(`FakeClientProxy: no reply scripted for "${pattern}"`));
    return new Observable<T>((subscriber) => {
      try {
        subscriber.next(handler(payload) as T);
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    });
  }
}
