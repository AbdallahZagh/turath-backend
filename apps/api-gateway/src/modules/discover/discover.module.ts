import { Module } from '@nestjs/common';
import { DiscoverController } from './discover.controller.js';

/** The landing page search widget (public). */
@Module({ controllers: [DiscoverController] })
export class DiscoverModule {}
