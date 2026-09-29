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

- **Sign up:** `POST /auth/register` (tourist or provider) sends a code to the phone; `POST /auth/otp/verify` finishes signup and signs in.
- **Email login:** `POST /auth/login/email` signs in directly (no code). The phone must have been verified at signup.
- **Phone login:** `POST /auth/login/phone` sends a code, `POST /auth/login/phone/verify` signs in.
- Every sign-in returns `accessToken` (15 min) and `refreshToken` in the body; web also gets HttpOnly cookies `turath_at` / `turath_rt`. Use `Authorization: Bearer <accessToken>`. There is no refresh endpoint: sign in again when the access token expires.
- **Password reset:** `POST /auth/password/forgot`, then `POST /auth/password/reset` (other devices stay signed in).
- `GET /auth/profile`. Sessions live in Redis: `GET /auth/sessions`, `DELETE /auth/sessions/:id`, `POST /auth/logout`, `POST /auth/logout/others`.

## Language, theme and errors

- Cookies shared with the frontend: `locale` (`en` | `ar`, read by next-intl) and `theme` (`light` | `dark` | `system`). Set them with `PUT /api/v1/preferences`; saved on the account when signed in and re-applied at login.
- Language order: `?lang=` → `locale` cookie → `x-lang` header → `Accept-Language` → `en`.
- Every error: `{ statusCode, code, message, errors?: [{ field, messages }], path, timestamp }`. `message` and field messages are translated; switch on `code`.
- Field messages: `i18n/{en,ar}/validation.json`. Error messages: `i18n/{en,ar}/errors/<service>.json`, one file per service (see [Errors per service](#errors-per-service)).

## Rate limiting and caching (Redis)

- Global: `THROTTLE_LIMIT` requests per `THROTTLE_TTL_SECONDS`, per user when signed in, otherwise per IP. OTP endpoints: 5/min per IP; identity also caps 3 codes per number per 15 min, with a 60 s resend cooldown.
- Set `TRUST_PROXY` only when a proxy you control sets `X-Forwarded-For`.
- Public GET responses: `@UseInterceptors(HttpCacheInterceptor)` + `@CacheTTL()` (the key includes the language). Identity caches user profiles and evicts them on write.

## Project structure

```
apps/<service>/
  src/
    main.ts  <service>.module.ts
    core/                  app-wide plumbing (guards, clients, prisma…), no business logic
    modules/<area>/        one folder per API area: module, controller/handler, service, dto/, docs
  test/
    unit/                  mirrors src/, no Docker
    e2e/ | integration/    gateway over HTTP · service against real Postgres + Redis
libs/
  common/                  errors, filters, i18n, env, phone utils, shared validation rules
  contracts/<service>/     patterns, payloads and errors: the only link between services
  redis/                   Redis client, sessions, throttler storage
  testing/                 FakeClientProxy, data builders, validateDto, TEST_ENV
i18n/{en,ar}/              validation.json, common.json, errors/<service>.json
test/smoke/                the whole docker compose stack
```

- **Gateway** (`apps/api-gateway`): controllers are thin (route → client call). Each endpoint's Swagger text is one decorator in `<area>.docs.ts` (`@RegisterDocs()`), and each request has its own file in `dto/`.
- **Services** (`apps/identity`): `<area>.handler.ts` holds only the RabbitMQ message patterns; `<area>.service.ts` holds the logic.
- **Validation:** DTO fields use the shared rules in `libs/common/src/validation` (`@IsPersonName()`, `@IsStrongPassword()`, `@IsPhoneFor()`…), so a rule and its EN/AR message are written once. A rule specific to one API lives in that module (e.g. `modules/auth/auth.validators.ts`).

## Errors per service

Each service declares its own errors next to its contracts, so a new service never edits another's:

```ts
// libs/contracts/src/booking/errors.ts
export const BookingError = defineErrors('booking', { SLOT_TAKEN: HttpStatus.CONFLICT });
// in the service
throw rpcError(BookingError.SLOT_TAKEN);
```

Add the messages to `i18n/en/errors/booking.json` and `i18n/ar/errors/booking.json`, and register the catalogue in `ERROR_CATALOGUES` (`libs/contracts/src/index.ts`). A unit test fails if a code is duplicated, missing a translation, or has a different `{placeholder}` in Arabic.

## Tests

| Command | What | Needs |
|---|---|---|
| `npm test` | unit: DTO rules, guards, mappers, error catalogues | nothing |
| `npm run test:e2e` | gateway over real HTTP, identity faked | Redis (`npm run docker:infra`) |
| `npm run test:integration` | identity handlers against a migrated `turath_identity_test` | Postgres + Redis |
| `npm run test:smoke` | register, verify, login, profile on the running stack | `docker compose up -d` |
| `npm run test:all` | unit + e2e + integration | Postgres + Redis |

Tests set their own environment (`libs/testing/src/test-env.ts`) and use Redis database 15, so they never touch dev data.

## Prisma

```bash
npm run db:generate                          # after schema changes
npm run db:migrate:dev -- --name <change>    # create + apply a migration
npm run db:migrate:deploy                    # apply in CI / prod
npm run db:studio                            # browse the data; prints the local URL
```

Schema: `apps/identity/prisma/schema.prisma`. Each future service gets its own schema, config and database (add it to `docker/postgres/init.sql`).

## Adding a service

1. `apps/<name>/` with the same layout as identity (`core/` + `modules/`), `main.ts` as an RMQ microservice, `tsconfig.app.json`, an entry in `nest-cli.json`.
2. `libs/contracts/src/<name>/`: patterns, payload types and its `defineErrors` catalogue (export it from the index and add it to `ERROR_CATALOGUES`); messages in `i18n/{en,ar}/errors/<name>.json`.
3. A `ClientsModule` entry and client wrapper in the gateway's `core/core.module.ts`, then a `modules/<area>/` folder per API area.
4. Build scripts in `package.json`, a service in `docker-compose.yml`, a database in `docker/postgres/init.sql`.
5. Tests: unit next to the code, an integration harness like `apps/identity/test/integration/identity.harness.ts`, and a case in `test/smoke`.
