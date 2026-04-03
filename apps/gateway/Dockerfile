FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/gateway/ ./apps/gateway/
RUN npm install --legacy-peer-deps
RUN npx nx build gateway --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3000
RUN npm i -g nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/gateway ./dist/apps/gateway
COPY --from=builder /usr/src/app/package.json ./package.json
RUN npm install --omit=dev --legacy-peer-deps
RUN chown -R node:node .
USER node
EXPOSE 3000
CMD ["dumb-init", "node", "dist/apps/gateway/main.js"]
