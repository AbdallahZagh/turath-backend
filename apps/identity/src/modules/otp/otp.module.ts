import { Module } from '@nestjs/common';
import { ConsoleOtpSender, OtpSender } from './otp.sender.js';
import { OtpService } from './otp.service.js';

/** One-time codes (Redis) and their delivery. Swap ConsoleOtpSender for a real SMS/email sender. */
@Module({
  providers: [OtpService, { provide: OtpSender, useClass: ConsoleOtpSender }],
  exports: [OtpService, OtpSender],
})
export class OtpModule {}
