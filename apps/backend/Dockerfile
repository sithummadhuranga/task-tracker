FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/backend apps/backend
WORKDIR /app/apps/backend
# prisma generate only needs a syntactically valid connection string, not a reachable
# database — the real one is supplied at runtime.
RUN DATABASE_URL="postgresql://user:pass@localhost:5432/db" pnpm run prisma:generate
RUN pnpm run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=build /app/apps/backend/package.json apps/backend/package.json
COPY --from=build /app/packages/shared-types packages/shared-types
RUN pnpm install --frozen-lockfile --prod
COPY --from=build /app/apps/backend/dist apps/backend/dist

USER node
WORKDIR /app/apps/backend
EXPOSE 4000
CMD ["node", "dist/main.js"]
