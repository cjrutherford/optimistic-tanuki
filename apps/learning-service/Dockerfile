FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/learning-service/ ./apps/learning-service/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build learning-service --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3024
WORKDIR /usr/src/app

# Install from the workspace manifest, before the build output is copied over
# it. The runtime dependencies then come at the versions this was built and
# tested against, rather than versions written down here that drift from them.
# This image previously pinned zod 3 while the workspace had moved to zod 4,
# which is a major version apart and would have failed at runtime on schemas
# that use the newer API.
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile

COPY --from=builder /usr/src/app/dist/apps/learning-service/ ./
USER node
EXPOSE 3024
CMD ["dumb-init", "node", "main.js"]
