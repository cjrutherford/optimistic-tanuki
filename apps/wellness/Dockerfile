FROM node:24-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/wellness/ ./apps/wellness/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build wellness --configuration=development

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist/apps/wellness/package.json ./package.json
COPY --from=builder /app/dist/apps/wellness/pnpm-lock.yaml ./pnpm-lock.yaml
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && CI=true pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist/apps/wellness ./wellness
USER nestjs
EXPOSE 3018
CMD ["node", "wellness/main.js"]
