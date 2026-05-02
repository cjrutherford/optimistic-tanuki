FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/assets/ ./apps/assets/
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build assets --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3005
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/assets/ ./
RUN corepack enable && pnpm add nodemon
RUN corepack enable && pnpm install --prod --no-frozen-lockfile
RUN corepack enable && pnpm add pg typeorm
RUN npm cache clean --force || true
RUN rm -rf node_modules/.cache || true
RUN chown -R node:node .
USER node
EXPOSE 3005
CMD ["dumb-init", "node", "main.js"]
