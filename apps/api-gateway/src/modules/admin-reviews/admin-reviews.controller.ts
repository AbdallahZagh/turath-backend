import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminReviewPatterns, type AdminReview, type AdminReviewPage } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { ParseIdPipe } from '../../core/pipes/parse-id.pipe.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { ListAdminReviewsDocs, SetReviewStatusDocs } from './admin-reviews.docs.js';
import { ListReviewsQueryDto, SetReviewStatusDto } from './dto/admin-review.dto.js';

/**
 * Review moderation for the admin dashboard, behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 */
@ApiTags('admin-reviews')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @ListAdminReviewsDocs()
  list(@Query() { page, limit, about, stars, status, search }: ListReviewsQueryDto): Promise<AdminReviewPage> {
    return this.identity.send(AdminReviewPatterns.LIST, { page, limit, about, stars, status, search });
  }

  @Patch(':id/status')
  @SetReviewStatusDocs()
  setStatus(@Param('id', ParseIdPipe) id: string, @Body() { status }: SetReviewStatusDto): Promise<AdminReview> {
    return this.identity.send(AdminReviewPatterns.SET_STATUS, { id, status });
  }
}
