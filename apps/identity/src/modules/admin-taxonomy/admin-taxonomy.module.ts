import { Module } from '@nestjs/common';
import { AdminTaxonomyCache } from './admin-taxonomy.cache.js';
import { AdminTaxonomyHandler } from './admin-taxonomy.handler.js';
import { AdminTaxonomyService } from './admin-taxonomy.service.js';

/** Categories, amenities and regions lists, reachable only through the gateway's API-key protected admin routes. */
@Module({ controllers: [AdminTaxonomyHandler], providers: [AdminTaxonomyService, AdminTaxonomyCache] })
export class AdminTaxonomyModule {}
