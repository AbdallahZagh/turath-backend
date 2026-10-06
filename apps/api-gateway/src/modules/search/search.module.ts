import { Module } from '@nestjs/common';
import { SearchController } from './search.controller.js';

/** The public global search. */
@Module({ controllers: [SearchController] })
export class SearchModule {}
