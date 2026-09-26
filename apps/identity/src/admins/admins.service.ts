import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { ErrorCode, rpcError } from '@turath/common';
import type { AdminCreatePayload, AdminPermission, AdminUpdatePayload, AdminView } from '@turath/contracts';
import { type Admin, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export function toAdminView(admin: Admin): AdminView {
  return {
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions as AdminPermission[],
    locked: admin.lockedAt !== null,
    lastLoginAt: admin.lastLoginAt?.toISOString() ?? null,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

const hash = (password: string) => argon2.hash(password, { type: argon2.argon2id });

/** Back-office accounts. Only reachable through the gateway's API-key protected admin routes. */
@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: AdminCreatePayload): Promise<AdminView> {
    try {
      const admin = await this.prisma.admin.create({
        data: {
          fullName: input.fullName,
          email: input.email,
          passwordHash: await hash(input.password),
          role: input.role,
          permissions: [...new Set(input.permissions)],
        },
      });
      return toAdminView(admin);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async list(): Promise<AdminView[]> {
    const admins = await this.prisma.admin.findMany({
      orderBy: { createdAt: 'asc' },
    });
    return admins.map(toAdminView);
  }

  async get(id: string): Promise<AdminView> {
    const admin = await this.prisma.admin.findUnique({ where: { id } });
    if (!admin) throw rpcError(ErrorCode.ADMIN_NOT_FOUND);
    return toAdminView(admin);
  }

  async update({ id, password, permissions, locked, ...fields }: AdminUpdatePayload): Promise<AdminView> {
    try {
      const admin = await this.prisma.admin.update({
        where: { id },
        data: {
          ...fields,
          ...(password && { passwordHash: await hash(password) }),
          ...(permissions && { permissions: [...new Set(permissions)] }),
          ...(locked !== undefined && { lockedAt: locked ? new Date() : null }),
        },
      });
      return toAdminView(admin);
    } catch (error) {
      throw mapPrismaError(error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.admin.delete({ where: { id } });
    } catch (error) {
      throw mapPrismaError(error);
    }
  }
}

function mapPrismaError(error: unknown): unknown {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return rpcError(ErrorCode.ADMIN_EMAIL_TAKEN);
    if (error.code === 'P2025') return rpcError(ErrorCode.ADMIN_NOT_FOUND);
  }
  return error;
}
