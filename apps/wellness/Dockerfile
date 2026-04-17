FROM node:20-alpine AS base

FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/wellness/ ./apps/wellness/
RUN npm install --legacy-peer-deps
RUN npx nx build wellness --configuration=development

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init && npm i -g nodemon
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist/apps/wellness ./wellness
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER nestjs
EXPOSE 3006
CMD ["node", "wellness/main.js"]
