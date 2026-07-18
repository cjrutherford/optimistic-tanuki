FROM docker.io/node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/locality/ ./apps/locality/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build locality --configuration=development

FROM docker.io/node:24-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3024
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm add -w nodemon pg typeorm
COPY --from=builder /usr/src/app/dist/apps/locality/ ./
RUN chown -R node:node .
USER node
EXPOSE 3024
CMD ["dumb-init", "node", "main.js"]
