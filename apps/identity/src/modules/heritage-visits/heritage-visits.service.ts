import { Injectable } from '@nestjs/common';
import { rpcError } from '@turath/common';
import { IdentityError } from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';

/** Counts visits of heritage sites, one counter per site and day (UTC). */
@Injectable()
export class HeritageVisitsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * One more visit of a published site today. A draft or unknown slug is HERITAGE_SITE_NOT_FOUND, so
   * nobody can tell a draft exists. A single atomic upsert: concurrent visits never lose a count.
   */
  async record(slug: string): Promise<void> {
    const counted = await this.prisma.$executeRaw`
      INSERT INTO heritage_site_visits (site_id, day, visits)
      SELECT id, (now() AT TIME ZONE 'UTC')::date, 1 FROM heritage_sites WHERE slug = ${slug} AND published
      ON CONFLICT (site_id, day) DO UPDATE SET visits = heritage_site_visits.visits + 1`;
    if (counted === 0) throw rpcError(IdentityError.HERITAGE_SITE_NOT_FOUND);
  }
}
