# syntax=docker/dockerfile:1

# Orbit Crew — production image (multi-stage, Bun-based).
#
# NOTE: the Prisma schema currently targets SQLite in the sandbox
# (docs/architecture/database.md). A database migration step
# (`prisma migrate deploy`) runs at DEPLOY time against the configured
# DATABASE_URL — it is NOT executed during image build, and this image
# does not embed database credentials.

# ---- deps -----------------------------------------------------------------
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- build ----------------------------------------------------------------
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client, then produce the standalone Next.js build.
# package.json "build" also copies .next/static and public into the
# standalone output directory.
RUN bunx prisma generate && bun run build

# ---- runner ---------------------------------------------------------------
FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 orbit && adduser --system --uid 1001 orbit

# Standalone server output (server.js + file-traced dependencies)
COPY --from=build --chown=orbit:orbit /app/.next/standalone ./
# Prisma client engine binaries, copied explicitly in case file tracing
# misses them for the current Prisma version.
COPY --from=build --chown=orbit:orbit /app/node_modules/.prisma ./node_modules/.prisma
# Schema ships with the image so a deploy-time migration runner can use it.
COPY --from=build --chown=orbit:orbit /app/prisma ./prisma

USER orbit
EXPOSE 3000

# curl is not present in the bun image; the healthcheck uses bun's fetch
# against the unauthenticated /api/health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD bun -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["bun", "server.js"]
