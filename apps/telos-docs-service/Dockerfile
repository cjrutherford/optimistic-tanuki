FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/telos-docs-service/ ./apps/telos-docs-service/
RUN npm install --legacy-peer-deps
RUN npx nx build telos-docs-service --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3008
RUN npm i -g nodemon pg zod
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/telos-docs-service/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps pg zod typeorm
RUN chown -R node:node .
USER node
EXPOSE 3008
CMD ["dumb-init", "node", "main.js"]
