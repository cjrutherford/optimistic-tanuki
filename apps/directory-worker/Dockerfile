FROM node:24-slim AS builder
WORKDIR /app
COPY . .
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile \
    && NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true pnpm exec nx build directory-worker
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate
COPY --from=builder /app/dist/apps/directory-worker/package.json /app/dist/apps/directory-worker/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist/apps/directory-worker/ ./
USER node
# The automatic Census boundary sweep reads TIGER archives with DuckDB, whose native binding needs glibc, and loads
# the spatial extension at runtime with autoinstall off, so the extension is installed into the image here.
RUN node -e "const {DuckDBInstance}=require('@duckdb/node-api');DuckDBInstance.create(':memory:').then(async d=>{const c=await d.connect();await c.run('INSTALL spatial');await c.run('LOAD spatial');console.log('spatial ready')})"
CMD ["node", "main.js"]
