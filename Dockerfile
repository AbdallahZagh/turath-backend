# One Dockerfile for every app in the monorepo:
#   docker build --build-arg APP=api-gateway --target runtime .
#   docker build --build-arg APP=identity    --target runtime .
#   docker build --target migrate .           (runs `prisma migrate deploy`)

ARG NODE_IMAGE=node:22-bookworm-slim

# ── deps: full install (build tools, prisma CLI) ──────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# Scripts are skipped here because postinstall needs the Prisma schema; the client is generated in `build`.
RUN npm ci --ignore-scripts

# ── build: generate Prisma clients and bundle the app with rspack ─────────
FROM deps AS build
ARG APP=api-gateway
COPY . .
RUN npm run db:generate && npx nest build ${APP}

# ── migrate: one-shot container that applies Prisma migrations ────────────
FROM build AS migrate
CMD ["npm", "run", "db:migrate:deploy"]

# ── prod-deps: runtime dependencies only ──────────────────────────────────
FROM ${NODE_IMAGE} AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ── runtime ───────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runtime
ARG APP=api-gateway
ENV NODE_ENV=production \
    APP=${APP}
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist/apps/${APP} ./dist
COPY --from=build --chown=node:node /app/i18n ./i18n
USER node
CMD ["node", "dist/main.js"]
