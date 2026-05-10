FROM docker.io/node:24-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/assets/ ./apps/assets/
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build assets --configuration=development

FROM docker.io/node:24-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3005
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --no-frozen-lockfile && \
    pnpm add -w pg typeorm nodemon && \
    npm cache clean --force || true
COPY --from=builder /usr/src/app/dist/apps/assets/ ./
RUN rm -rf node_modules/.cache || true
RUN chown -R node:node .
USER node
EXPOSE 3005
CMD ["dumb-init", "node", "main.js"]
