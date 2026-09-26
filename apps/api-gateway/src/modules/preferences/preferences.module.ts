import { Module } from '@nestjs/common';
import { PreferencesController } from './preferences.controller.js';

@Module({ controllers: [PreferencesController] })
export class PreferencesModule {}
