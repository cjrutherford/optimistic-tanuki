FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/payments/ ./apps/payments/
RUN npm install --legacy-peer-deps
RUN npx nx build payments --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3018
RUN npm i -g nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/payments/ ./
COPY --from=builder /usr/src/app/apps/payments/src/assets ./apps/payments/src/assets
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps pg typeorm
RUN chown -R node:node /usr/src/app
USER node
EXPOSE 3018
CMD ["dumb-init", "node", "main.js"]
