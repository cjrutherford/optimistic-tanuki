FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/videos/ ./apps/videos/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build videos --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3009
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/videos/ ./
RUN corepack enable && pnpm install --prod --no-frozen-lockfile && \
    pnpm add nodemon && \
    npm cache clean --force || true
RUN corepack enable && pnpm add pg typeorm
RUN rm -rf node_modules/.cache || true
RUN chown -R node:node .
USER node
EXPOSE 3009
CMD ["dumb-init", "node", "main.js"]
