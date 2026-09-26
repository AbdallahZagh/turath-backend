import { Module } from '@nestjs/common';
import { SessionsHandler } from './sessions.handler.js';

@Module({ controllers: [SessionsHandler] })
export class SessionsModule {}
