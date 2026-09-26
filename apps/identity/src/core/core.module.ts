import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

/** Shared by every identity module: the database client. */
@Global()
@Module({ providers: [PrismaService], exports: [PrismaService] })
export class CoreModule {}
