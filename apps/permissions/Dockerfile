FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/permissions/ ./apps/permissions/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build permissions --configuration=development

FROM docker.io/node:lts-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3012
COPY --from=builder /usr/src/app/dist/apps/permissions/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add pg typeorm nodemon
RUN chown -R node:node .
USER node
EXPOSE 3012
CMD ["dumb-init", "node", "main.js"]
