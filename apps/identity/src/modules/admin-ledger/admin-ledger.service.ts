import { Injectable } from '@nestjs/common';
import { pageWindow, rpcError, toPage } from '@turath/common';
import {
  IdentityError,
  type AdminLedgerDetail,
  type AdminLedgerListPayload,
  type AdminLedgerPage,
} from '@turath/contracts';
import { PrismaService } from '../../core/prisma/prisma.service.js';
import { containsInsensitive } from '../../core/prisma/search.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { toDbCategory } from '../admin-bookings/booking.mapper.js';
import { AdminLedgerCache } from './admin-ledger.cache.js';
import { buildLedgerStatements } from './ledger-statements.js';
import { toAdminLedgerRow, toDbStanding } from './ledger.mapper.js';

/** Every filter given must match; `search` matches the provider name in either language. */
function where({ category, standing, search }: AdminLedgerListPayload): Prisma.LedgerAccountWhereInput {
  return {
    ...(category && { category: toDbCategory(category) }),
    ...(standing && { standing: toDbStanding(standing) }),
    ...(search && {
      OR: [{ providerNameEn: containsInsensitive(search) }, { providerNameAr: containsInsensitive(search) }],
    }),
  };
}

const listKey = ({ page, limit, category, standing, search }: AdminLedgerListPayload) =>
  ['list', page, limit, category ?? '', standing ?? '', search?.toLowerCase() ?? ''].join(':');

/** Provider accounts for the admin dashboard. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminLedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: AdminLedgerCache,
  ) {}

  /** One page of accounts in the order they were opened. A page past the end is empty, not an error. */
  list(query: AdminLedgerListPayload): Promise<AdminLedgerPage> {
    return this.cache.remember(listKey(query), async () => {
      const filter = where(query);
      const [rows, total] = await this.prisma.$transaction([
        this.prisma.ledgerAccount.findMany({
          where: filter,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          ...pageWindow(query),
        }),
        this.prisma.ledgerAccount.count({ where: filter }),
      ]);
      return toPage(rows.map(toAdminLedgerRow), total, query);
    });
  }

  /** One account with its statements. An unknown id is LEDGER_NOT_FOUND (never cached). */
  get(id: string): Promise<AdminLedgerDetail> {
    return this.cache.remember(`item:${id}`, async () => {
      const account = await this.prisma.ledgerAccount.findUnique({ where: { id } });
      if (!account) throw rpcError(IdentityError.LEDGER_NOT_FOUND);

      const ledger = toAdminLedgerRow(account);
      return { ledger, statements: buildLedgerStatements(ledger), providerId: account.providerId };
    });
  }
}
