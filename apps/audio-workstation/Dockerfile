FROM node:24-alpine AS builder

WORKDIR /usr/src/app

ARG GIT_SHA=unknown

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/audio-workstation ./apps/audio-workstation

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && pnpm install --frozen-lockfile
RUN pnpm exec nx build audio-workstation --configuration=production

FROM node:24-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

ARG GIT_SHA=unknown

ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}

COPY --from=builder /usr/src/app/dist/apps/audio-workstation .

EXPOSE 3025

ENTRYPOINT ["dumb-init", "node", "main.js"]
