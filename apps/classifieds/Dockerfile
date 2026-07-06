FROM node:24-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/classifieds/ ./apps/classifieds/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build classifieds --configuration=development

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist/apps/classifieds/package.json ./package.json
COPY --from=builder /app/dist/apps/classifieds/pnpm-lock.yaml ./pnpm-lock.yaml
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && CI=true pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist/apps/classifieds ./classifieds
COPY --from=builder /app/apps/classifieds/src/assets ./assets
USER nestjs
EXPOSE 3017
CMD ["node", "classifieds/main.js"]
