import { Module } from '@nestjs/common';
import { AdminDisputesCache } from './admin-disputes.cache.js';
import { AdminDisputesHandler } from './admin-disputes.handler.js';
import { AdminDisputesService } from './admin-disputes.service.js';

/** Disputes page and drawer, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminDisputesHandler], providers: [AdminDisputesService, AdminDisputesCache] })
export class AdminDisputesModule {}
