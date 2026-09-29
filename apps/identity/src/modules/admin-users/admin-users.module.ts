import { Module } from '@nestjs/common';
import { AdminUsersHandler } from './admin-users.handler.js';
import { AdminUsersService } from './admin-users.service.js';

/** Guests (tourists) for the admin dashboard, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminUsersHandler], providers: [AdminUsersService] })
export class AdminUsersModule {}
