FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/permissions/ ./apps/permissions/
RUN npm install --legacy-peer-deps
RUN npx nx build permissions --configuration=development

FROM docker.io/node:lts-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3012
COPY --from=builder /usr/src/app/dist/apps/permissions/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm install --legacy-peer-deps pg typeorm nodemon
RUN chown -R node:node .
USER node
EXPOSE 3012
CMD ["dumb-init", "node", "main.js"]
