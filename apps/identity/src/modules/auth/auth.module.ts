import { Module } from '@nestjs/common';
import { OtpModule } from '../otp/otp.module.js';
import { UsersModule } from '../users/users.module.js';
import { AuthHandler } from './auth.handler.js';
import { AuthService } from './auth.service.js';

@Module({
  imports: [OtpModule, UsersModule],
  controllers: [AuthHandler],
  providers: [AuthService],
})
export class AuthModule {}
