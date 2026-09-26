import { Module } from '@nestjs/common';
import { AdminsHandler } from './admins.handler.js';
import { AdminsService } from './admins.service.js';

/** Back-office accounts, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminsHandler], providers: [AdminsService] })
export class AdminsModule {}
