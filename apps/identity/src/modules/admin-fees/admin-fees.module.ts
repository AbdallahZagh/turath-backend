import { Module } from '@nestjs/common';
import { AdminFeesCache } from './admin-fees.cache.js';
import { AdminFeesHandler } from './admin-fees.handler.js';
import { AdminFeesService } from './admin-fees.service.js';

/** Fees page, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminFeesHandler], providers: [AdminFeesService, AdminFeesCache] })
export class AdminFeesModule {}
