FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/app-configurator/ ./apps/app-configurator/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build app-configurator --configuration=development

FROM docker.io/node:lts-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3014
RUN corepack enable && pnpm add nodemon pg
COPY --from=builder /usr/src/app/dist/apps/app-configurator/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add pg typeorm
RUN mkdir -p ./seed-data && cp ./seed-script.js ./seed-data/seed-script.js
RUN mkdir -p ./seed-data/assets && cp ./assets/config.yaml ./seed-data/assets/config.yaml
RUN chown -R node:node .
USER node
EXPOSE 3014
CMD ["dumb-init", "node", "main.js"]
