FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/lead-tracker/ ./apps/lead-tracker/
RUN npm install --legacy-peer-deps
RUN npx nx build lead-tracker --configuration=production

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3020
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/lead-tracker/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps pg typeorm
RUN chown -R node:node .
USER node
EXPOSE 3020
CMD ["dumb-init", "node", "main.js"]
