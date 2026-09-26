# Turath (تراث) — Backend

NestJS 12 microservices for the Turath tourism platform.

| App | Role | Port |
|---|---|---|
| `apps/api-gateway` | Only public HTTP entry. Auth guards, validation, i18n, rate limiting, caching, Swagger. | 4000 |
| `apps/identity` | Users, OTP login, sessions, password reset. Owns the `turath_identity` database (Prisma). | RabbitMQ (health on 4001) |

Shared code: `libs/common` (errors, i18n, env, phone utils), `libs/contracts` (message patterns + payload types), `libs/redis` (Redis client, sessions, throttler storage).

Stack: NestJS 12 (ESM) · Prisma 7 + PostgreSQL · Redis · RabbitMQ · nestjs-i18n · Swagger · Docker.

## Run everything in Docker

```bash
cp .env.example .env
docker compose up -d --build
```

- Swagger UI: http://localhost:4000/api/docs (raw spec: `/api/docs-json`)
- Health: http://localhost:4000/health
- RabbitMQ UI: http://localhost:15672 (turath / turath)

`identity-migrate` applies Prisma migrations before `identity` starts.

## Run the apps locally (infra in Docker)

```bash
cp .env.example .env
npm install                 # also generates the Prisma client
npm run docker:infra        # postgres, redis, rabbitmq
npm run db:migrate:deploy
npm run start:identity      # terminal 1
npm run start:gateway       # terminal 2
```

With `OTP_DEV_ECHO=true` the OTP / reset token is returned in the API response as `devCode` (local only) and logged by identity.

## Auth flow

1. `POST /api/v1/auth/register`, `POST /api/v1/auth/login/email` or `POST /api/v1/auth/otp/send` → a 6-digit code is sent.
2. `POST /api/v1/auth/otp/verify` → session created.
   - Web: HttpOnly cookies `turath_at` (access, 15 min) and `turath_rt` (refresh, 30 days, path `/api/v1/auth`).
   - Mobile: send `X-Client-Type: mobile` to also get `refreshToken` in the body; use `Authorization: Bearer`.
3. `POST /api/v1/auth/refresh` rotates the refresh token. Replaying an old one signs that session out (`REFRESH_TOKEN_REUSED`). A parallel refresh from another tab gets `409 REFRESH_RACE`; just retry.
4. Sessions live in Redis: `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout`, `POST /auth/logout/others`.

## Language, theme and errors

- Cookies shared with the frontend: `locale` (`en` | `ar`, read by next-intl) and `theme` (`light` | `dark` | `system`). Set them with `PUT /api/v1/preferences`; saved on the account when signed in and re-applied at login.
- Language order: `?lang=` → `locale` cookie → `x-lang` header → `Accept-Language` → `en`.
- Every error: `{ statusCode, code, message, errors?: [{ field, messages }], path, timestamp }`. `message` and field messages are translated; switch on `code`. Translations live in `i18n/{en,ar}/*.json`.

## Rate limiting and caching (Redis)

- Global: `THROTTLE_LIMIT` requests per `THROTTLE_TTL_SECONDS`, per user when signed in, otherwise per IP. OTP endpoints: 5/min per IP; identity also caps 3 codes per number per 15 min, with a 60 s resend cooldown.
- Set `TRUST_PROXY` only when a proxy you control sets `X-Forwarded-For`.
- Public GET responses: `@UseInterceptors(HttpCacheInterceptor)` + `@CacheTTL()` (the key includes the language). Identity caches user profiles and evicts them on write.

## Prisma

```bash
npm run db:generate                          # after schema changes
npm run db:migrate:dev -- --name <change>    # create + apply a migration
npm run db:migrate:deploy                    # apply in CI / prod
```

Schema: `apps/identity/prisma/schema.prisma`. Each future service gets its own schema, config and database (add it to `docker/postgres/init.sql`).

## Adding a service

1. `apps/<name>/src/main.ts` as an RMQ microservice (copy identity), `tsconfig.app.json`, entry in `nest-cli.json`.
2. Patterns and payload types in `libs/contracts`.
3. A `ClientsModule` entry + client wrapper in the gateway.
4. Build scripts in `package.json` and a service in `docker-compose.yml`.
