FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat dumb-init
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

FROM base AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init && npm i -g nodemon

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

COPY --from=builder /app/dist/apps/classifieds ./classifieds
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER nestjs

EXPOSE 3017

CMD ["node", "classifieds/main.js"]
