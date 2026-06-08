# CORA API — Hono + Bun (WebSocket matchmaking + Solana settlement).
#
# Build context MUST be the repo root (the API imports workspace packages):
#   docker build -f apps/api/Dockerfile -t cora-api .
#
# The server reads all config from env at runtime — never bake secrets into the
# image. Provide them via your platform's secret store (see apps/api/fly.toml).

# ── install stage ─────────────────────────────────────────────────────────────
# Copy only the workspace manifests first so `bun install` is cached until a
# dependency actually changes (not on every source edit).
FROM oven/bun:1.3.14-slim AS install
WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared-types/package.json ./packages/shared-types/package.json
COPY packages/game-logic/package.json ./packages/game-logic/package.json
RUN bun install --frozen-lockfile

# ── runtime stage ─────────────────────────────────────────────────────────────
FROM oven/bun:1.3.14-slim AS release
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Installed dependencies (hoisted to the workspace root node_modules).
COPY --from=install /app/node_modules ./node_modules
# Root manifest + lockfile drive workspace resolution.
COPY package.json bun.lock ./
# API source + only the workspace packages it imports at runtime. Bun resolves
# @shared/* and @cora/game-logic via apps/api/tsconfig.json "paths".
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types
COPY packages/game-logic ./packages/game-logic

WORKDIR /app/apps/api
EXPOSE 8080
# Bun runs the TypeScript entrypoint directly — no separate build step.
CMD ["bun", "run", "src/index.ts"]
