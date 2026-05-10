FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/system-configurator-api/ ./apps/system-configurator-api/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build system-configurator-api --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3021
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/system-configurator-api/ ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add nodemon pg @nestjs/typeorm typeorm reflect-metadata
RUN chown -R node:node .
USER node
EXPOSE 3021
CMD ["dumb-init", "node", "main.js"]
