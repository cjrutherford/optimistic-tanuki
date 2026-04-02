FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/assets/ ./apps/assets/
RUN npm install --legacy-peer-deps
RUN npx nx build assets --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3005
RUN npm i -g nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/assets ./dist/apps/assets
COPY --from=builder /usr/src/app/package.json ./package.json
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps pg
RUN chown -R node:node .
USER node
EXPOSE 3005
CMD ["dumb-init", "node", "dist/apps/assets/main.js"]
