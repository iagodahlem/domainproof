# syntax=docker/dockerfile:1

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# ---- build: install workspace deps, compile, and produce a deployable
# subset of the api package (prod deps only) via `pnpm deploy` ----
FROM base AS build
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=api...
RUN pnpm --filter=api deploy /prod/api --prod

# ---- runtime: minimal image, non-root user, only the deployed output ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 api \
  && useradd --system --uid 1001 --gid api api

COPY --from=build --chown=api:api /prod/api/dist ./dist
COPY --from=build --chown=api:api /prod/api/package.json ./package.json
COPY --from=build --chown=api:api /prod/api/node_modules ./node_modules
# Migrations run at boot (see src/index.ts) against this folder, resolved
# relative to dist/index.js at runtime — must land one level up from dist,
# same as package.json above.
COPY --from=build --chown=api:api /prod/api/drizzle ./drizzle

USER api
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3001) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "dist/index.js"]
