FROM node:20-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/classifieds/ ./apps/classifieds/
RUN npm install --legacy-peer-deps
RUN npx nx build classifieds --configuration=development

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init && npm i -g nodemon
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
RUN npm i -g typeorm
COPY --from=builder /app/dist/apps/classifieds ./classifieds
COPY --from=builder /app/apps/classifieds/src/assets ./assets
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nestjs
EXPOSE 3017
CMD ["node", "classifieds/main.js"]
