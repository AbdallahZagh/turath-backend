import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller.js';

@Module({ controllers: [ProfileController] })
export class ProfileModule {}
