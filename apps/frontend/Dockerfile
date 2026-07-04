FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages/shared-types packages/shared-types
COPY apps/frontend apps/frontend
# shared-types ships compiled JS (see its package.json "exports") — build it before anything
# that imports from it, even though Vite itself would otherwise happily bundle raw TS.
RUN pnpm --filter @task-tracker/shared-types run build
WORKDIR /app/apps/frontend
RUN pnpm run build

FROM nginx:alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
