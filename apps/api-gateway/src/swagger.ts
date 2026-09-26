import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { LOCALES } from '@turath/common';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './auth/auth.cookies.js';

/** Swagger UI at /api/docs, raw spec at /api/docs-json (feed it to orval / openapi-typescript). */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Turath API')
    .setDescription(
      [
        'Public API of the Turath (تراث) platform.',
        '',
        '**Language:** errors and messages follow `?lang=`, then the `locale` cookie, then `x-lang`, then `Accept-Language` (en | ar).',
        '**Auth:** web uses HttpOnly cookies set by `/auth/otp/verify`; mobile sends `Authorization: Bearer <accessToken>`.',
        '**Errors:** every error has the shape `{ statusCode, code, message, errors?, path, timestamp }`. Switch on `code`.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth(ACCESS_COOKIE, { type: 'apiKey', in: 'cookie', name: ACCESS_COOKIE })
    .addCookieAuth(REFRESH_COOKIE, { type: 'apiKey', in: 'cookie', name: REFRESH_COOKIE }, 'refresh-cookie')
    .addGlobalParameters({
      name: 'lang',
      in: 'query',
      required: false,
      description: 'Response language override',
      schema: { type: 'string', enum: [...LOCALES] },
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: { persistAuthorization: true, withCredentials: true },
  });
}
