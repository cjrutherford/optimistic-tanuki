FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/profile/ ./apps/profile/
RUN npm install --legacy-peer-deps
RUN npx nx build profile --configuration=development

FROM docker.io/node:lts-alpine AS runner
WORKDIR /usr/src/app
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3002
RUN npm i -g nodemon
COPY --from=builder /usr/src/app/dist/apps/profile/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps pg typeorm
RUN chown -R node:node .
USER node
EXPOSE 3002
CMD ["dumb-init", "node", "main.js"]
