import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const { swaggerEnabled } = configureApp(app);
  app.enableShutdownHooks();

  const port = Number(app.get(ConfigService).get('PORT') ?? 4000);
  await app.listen(port);
  Logger.log(`gateway on http://localhost:${port}/api/v1${swaggerEnabled ? ` · docs /api/docs` : ''}`, 'Bootstrap');
}

await bootstrap();
