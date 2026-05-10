FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/profile/ ./apps/profile/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build profile --configuration=development

FROM docker.io/node:lts-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3002
COPY --from=builder /usr/src/app/dist/apps/profile/ ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add nodemon pg typeorm
RUN chown -R node:node .
USER node
EXPOSE 3002
CMD ["dumb-init", "node", "main.js"]
