import { Module } from '@nestjs/common';
import { HealthHandler } from './health.handler.js';

@Module({ controllers: [HealthHandler] })
export class HealthModule {}
