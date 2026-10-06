import { Module } from '@nestjs/common';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { AdminTaxonomyController } from './admin-taxonomy.controller.js';

/** Categories, amenities and regions lists for the admin dashboard, protected by ADMIN_API_KEYS. */
@Module({ controllers: [AdminTaxonomyController], providers: [ApiKeyGuard] })
export class AdminTaxonomyModule {}
