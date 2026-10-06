import { Module } from '@nestjs/common';
import { HeritageVisitsHandler } from './heritage-visits.handler.js';
import { HeritageVisitsService } from './heritage-visits.service.js';

/** Counts the visits of heritage sites (public) for the dashboard's top attractions. */
@Module({ controllers: [HeritageVisitsHandler], providers: [HeritageVisitsService] })
export class HeritageVisitsModule {}
