import { Module } from '@nestjs/common';
import { HeritageVisitsController } from './heritage-visits.controller.js';

/** Public visit counter of the heritage sites. */
@Module({ controllers: [HeritageVisitsController] })
export class HeritageVisitsModule {}
