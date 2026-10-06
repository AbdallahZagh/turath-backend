import { Module } from '@nestjs/common';
import { SearchCache } from './search.cache.js';
import { SearchHandler } from './search.handler.js';
import { SearchService } from './search.service.js';

/** Global search. Exports the cache so the modules that write searchable data can drop it. */
@Module({ controllers: [SearchHandler], providers: [SearchService, SearchCache], exports: [SearchCache] })
export class SearchModule {}
