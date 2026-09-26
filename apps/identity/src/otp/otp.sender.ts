import { Injectable, Logger } from '@nestjs/common';
import type { AuthChannel } from '@turath/contracts';
import type { Locale } from '@turath/common';

export type OutboundMessage =
  | { kind: 'otp'; channel: AuthChannel; destination: string; code: string; locale: Locale }
  | { kind: 'password-reset'; channel: AuthChannel; destination: string; token: string; locale: Locale };

/**
 * Delivery port for one-time codes. The real implementation will publish to
 * the notification service (WhatsApp → local SMS → flash call fallback).
 */
export abstract class OtpSender {
  abstract send(message: OutboundMessage): Promise<void>;
}

/** Development sender: writes codes to the log instead of sending them. */
@Injectable()
export class ConsoleOtpSender extends OtpSender {
  private readonly logger = new Logger('OtpSender');

  async send(message: OutboundMessage): Promise<void> {
    const secret = message.kind === 'otp' ? `code ${message.code}` : `reset token ${message.token}`;
    this.logger.warn(`[dev] ${message.kind} via ${message.channel} to ${message.destination}: ${secret}`);
  }
}
