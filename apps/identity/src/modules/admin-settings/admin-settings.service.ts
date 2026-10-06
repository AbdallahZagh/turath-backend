import { Injectable } from '@nestjs/common';
import { DEFAULT_SETTINGS, type AdminSettings, type OtpChannel } from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { Prisma, type PlatformSettings } from '../../generated/prisma/client.js';
import { AdminFeaturedCache } from '../admin-featured/admin-featured.cache.js';
import { AdminFeaturedService } from '../admin-featured/admin-featured.service.js';

type Client = PrismaService | Prisma.TransactionClient;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

/** The columns this page owns, from what was saved. */
const columns = ({ creditCeilingsSyp, reliability, flags }: AdminSettings) => ({
  creditCeilingNewSyp: creditCeilingsSyp.new,
  creditCeilingEstablishedSyp: creditCeilingsSyp.established,
  creditCeilingEnterpriseSyp: creditCeilingsSyp.enterprise,
  vipAtOrAbove: reliability.vipAtOrAbove,
  standardAtOrAbove: reliability.standardAtOrAbove,
  restrictedAtOrAbove: reliability.restrictedAtOrAbove,
  lockSuspended: reliability.lockSuspended,
  otpChannel: flags.otpChannel.toUpperCase() as PlatformSettings['otpChannel'],
  webCheckIn: flags.webCheckIn,
});

/**
 * The settings page of the admin dashboard. Only reachable through the gateway's API-key protected admin routes.
 *
 * The home page featuring switches on this page are the ones the Featured module keeps, so a save
 * writes both in one transaction and either API shows the other's changes. Not cached for that
 * reason: it is three small lookups, and a stale answer here would contradict `GET /admin/featured/slots`.
 */
@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly featured: AdminFeaturedService,
    private readonly featuredCache: AdminFeaturedCache,
  ) {}

  /** Everything on the page. Anything never saved shows its default. */
  get(): Promise<AdminSettings> {
    return this.read(this.prisma);
  }

  /** Saves the whole page at once, all or nothing, and returns what is now stored. */
  async save(input: AdminSettings): Promise<AdminSettings> {
    try {
      await this.store(input);
    } catch (error) {
      // Two first saves racing to create the one row: the loser simply updates it.
      if (!isUniqueViolation(error)) throw error;
      await this.store(input);
    }
    await this.featuredCache.invalidate(); // the slot switches are shared with the Featured page
    return this.read(this.prisma);
  }

  private store(input: AdminSettings): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const data = columns(input);
      await tx.platformSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data });
      await this.featured.applySlots(tx, {
        featuringEnabled: input.flags.featuringEnabled,
        slots: input.flags.featuredSlots,
      });
    });
  }

  private async read(client: Client): Promise<AdminSettings> {
    const [row, switches] = await Promise.all([
      client.platformSettings.findUnique({ where: { id: 1 } }),
      this.featured.flags(client),
    ]);

    return {
      creditCeilingsSyp: row
        ? {
            new: row.creditCeilingNewSyp,
            established: row.creditCeilingEstablishedSyp,
            enterprise: row.creditCeilingEnterpriseSyp,
          }
        : { ...DEFAULT_SETTINGS.creditCeilingsSyp },
      reliability: row
        ? {
            vipAtOrAbove: row.vipAtOrAbove,
            standardAtOrAbove: row.standardAtOrAbove,
            restrictedAtOrAbove: row.restrictedAtOrAbove,
            lockSuspended: row.lockSuspended,
          }
        : { ...DEFAULT_SETTINGS.reliability },
      flags: {
        otpChannel: row ? (row.otpChannel.toLowerCase() as OtpChannel) : DEFAULT_SETTINGS.otpChannel,
        featuringEnabled: switches.featuringEnabled,
        featuredSlots: { ...switches.slots },
        webCheckIn: row ? row.webCheckIn : DEFAULT_SETTINGS.webCheckIn,
      },
    };
  }
}
