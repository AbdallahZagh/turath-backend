import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { setupSwagger } from './swagger.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const swaggerEnabled = String(config.get('SWAGGER_ENABLED')) === 'true';

  // Only trust X-Forwarded-For when a proxy we control sets it; otherwise clients could
  // spoof their IP and dodge per-IP rate limits. TRUST_PROXY = number of proxy hops.
  const trustProxy = Number(config.get('TRUST_PROXY'));
  if (trustProxy > 0) app.set('trust proxy', trustProxy);
  // Swagger UI needs inline scripts, so CSP is relaxed only when the docs are on.
  app.use(helmet({ contentSecurityPolicy: swaggerEnabled ? false : undefined }));
  app.use(cookieParser());
  app.enableCors({
    origin: String(config.get('CORS_ORIGINS'))
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    credentials: true,
  });

  // → /api/v1/...   (GET /health stays at the root)
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (swaggerEnabled) setupSwagger(app);

  const port = Number(config.get('PORT') ?? 4000);
  await app.listen(port);
  Logger.log(`gateway on http://localhost:${port}/api/v1${swaggerEnabled ? ` · docs /api/docs` : ''}`, 'Bootstrap');
}

await bootstrap();
