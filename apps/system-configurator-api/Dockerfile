FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/system-configurator-api/ ./apps/system-configurator-api/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build system-configurator-api --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3021
WORKDIR /usr/src/app
RUN corepack enable && pnpm add nodemon pg
COPY --from=builder /usr/src/app/dist/apps/system-configurator-api/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add @nestjs/typeorm typeorm pg reflect-metadata
RUN chown -R node:node .
USER node
EXPOSE 3021
CMD ["dumb-init", "node", "main.js"]
