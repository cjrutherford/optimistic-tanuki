FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/ai-orchestrator/ ./apps/ai-orchestrator/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build ai-orchestrator --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3010
RUN corepack enable && pnpm add nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/ai-orchestrator/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add @nestjs/axios @modelcontextprotocol/sdk eventsource @langchain/ollama typeorm
RUN chown -R node:node .
USER node
EXPOSE 3010
CMD ["dumb-init", "node", "main.js"]
