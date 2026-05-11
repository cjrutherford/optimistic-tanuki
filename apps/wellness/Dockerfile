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
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon
COPY --from=builder /app/dist/apps/wellness ./wellness
COPY --from=builder /app/node_modules ./node_modules
USER nestjs
EXPOSE 3018
CMD ["node", "wellness/main.js"]
