FROM docker.io/node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/ai-orchestrator/ ./apps/ai-orchestrator/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build ai-orchestrator --configuration=development

FROM docker.io/node:24-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3010
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon pg
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w @nestjs/axios @modelcontextprotocol/sdk eventsource @langchain/ollama typeorm
COPY --from=builder /usr/src/app/dist/apps/ai-orchestrator/ ./
RUN chown -R node:node .
USER node
EXPOSE 3010
CMD ["dumb-init", "node", "main.js"]
