FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/authentication/ ./apps/authentication/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build authentication --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3001
RUN corepack enable && pnpm add nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/authentication/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add typeorm
RUN chown -R node:node .
USER node
EXPOSE 3001
CMD ["dumb-init", "node", "main.js"]
