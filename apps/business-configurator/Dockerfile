FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/business-configurator ./apps/business-configurator

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build business-configurator --configuration=production

FROM node:24-alpine

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --prod --frozen-lockfile

COPY --from=builder /usr/src/app/dist/apps/business-configurator ./dist/apps/business-configurator

EXPOSE 4000

CMD ["dumb-init", "node", "/app/dist/apps/business-configurator/server/server.mjs"]
