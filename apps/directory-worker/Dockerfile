FROM node:24-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile \
    && NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true pnpm exec nx build directory-worker
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=builder /app/dist/apps/directory-worker/package.json /app/dist/apps/directory-worker/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist/apps/directory-worker/ ./
USER node
CMD ["node", "main.js"]
