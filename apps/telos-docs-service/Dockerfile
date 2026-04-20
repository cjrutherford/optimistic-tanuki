FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/telos-docs-service/ ./apps/telos-docs-service/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build telos-docs-service --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3008
RUN corepack enable && pnpm add nodemon pg zod
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/telos-docs-service/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add pg zod typeorm
RUN chown -R node:node .
USER node
EXPOSE 3008
CMD ["dumb-init", "node", "main.js"]
