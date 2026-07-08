FROM node:24-alpine AS builder

WORKDIR /usr/src/app

ARG GIT_SHA=unknown

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/orchestra-client ./apps/orchestra-client

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build orchestra-client --configuration=production

FROM node:24-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

ARG GIT_SHA=unknown

ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}
ENV PORT=4000

COPY --from=builder /usr/src/app/dist/apps/orchestra-client .

EXPOSE 4000

ENTRYPOINT ["dumb-init", "node", "server/main.js"]
