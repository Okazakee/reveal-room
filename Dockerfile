# syntax=docker/dockerfile:1
#
# Reveal Room — single-process production image (canonical deployment).
# Bun is the package manager and server runtime (verified locally).
# Exactly ONE application process per container; no cluster mode.

FROM oven/bun:1.3-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies -------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# --- build --------------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# --- runtime ------------------------------------------------------------
FROM oven/bun:1.3-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY package.json next.config.ts ./
# No application state volume: rooms are intentionally ephemeral in memory.
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

USER bun
CMD ["bun", "run", "start"]
