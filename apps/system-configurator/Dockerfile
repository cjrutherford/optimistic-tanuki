FROM node:lts-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/system-configurator ./apps/system-configurator

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build system-configurator --configuration=production

FROM node:lts-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=builder /usr/src/app/dist/apps/system-configurator ./dist/apps/system-configurator

EXPOSE 4000

CMD ["dumb-init", "node", "/app/dist/apps/system-configurator/server/server.mjs"]
