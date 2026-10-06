import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AdminSettingsPatterns, type AdminSettings } from '@turath/contracts';
import { Public } from '../../core/auth/auth.decorators.js';
import { IdentityClient } from '../../core/clients/identity.client.js';
import { AdminKeyRequired } from '../admin/admin.docs.js';
import { ApiKeyGuard } from '../admin/api-key.guard.js';
import { GetSettingsDocs, SaveSettingsDocs } from './admin-settings.docs.js';
import { AdminSettingsDto } from './dto/admin-settings.dto.js';

/**
 * The settings page of the admin dashboard (`/admin/settings`) behind `x-api-key` (see ApiKeyGuard).
 * `@Public()` only skips the user JWT check; ApiKeyGuard is the gate.
 */
@ApiTags('admin-settings')
@AdminKeyRequired()
@Public()
@UseGuards(ApiKeyGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly identity: IdentityClient) {}

  @Get()
  @GetSettingsDocs()
  get(): Promise<AdminSettings> {
    return this.identity.send<AdminSettings, Record<string, never>>(AdminSettingsPatterns.GET, {});
  }

  @Put()
  @SaveSettingsDocs()
  save(@Body() { creditCeilingsSyp, reliability, flags }: AdminSettingsDto): Promise<AdminSettings> {
    return this.identity.send<AdminSettings, AdminSettings>(AdminSettingsPatterns.SAVE, {
      creditCeilingsSyp: {
        new: creditCeilingsSyp.new,
        established: creditCeilingsSyp.established,
        enterprise: creditCeilingsSyp.enterprise,
      },
      reliability: {
        vipAtOrAbove: reliability.vipAtOrAbove,
        standardAtOrAbove: reliability.standardAtOrAbove,
        restrictedAtOrAbove: reliability.restrictedAtOrAbove,
        lockSuspended: reliability.lockSuspended,
      },
      flags: {
        otpChannel: flags.otpChannel,
        featuringEnabled: flags.featuringEnabled,
        featuredSlots: { ...flags.featuredSlots },
        webCheckIn: flags.webCheckIn,
      },
    });
  }
}
