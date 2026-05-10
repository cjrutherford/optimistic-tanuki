FROM node:20-alpine AS base

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
RUN apk add --no-cache dumb-init && corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w typeorm
COPY --from=builder /app/dist/apps/classifieds ./classifieds
COPY --from=builder /app/apps/classifieds/src/assets ./assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nestjs
EXPOSE 3017
CMD ["node", "classifieds/main.js"]
