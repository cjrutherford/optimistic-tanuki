FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/authentication/ ./apps/authentication/
RUN npm install --legacy-peer-deps
RUN npx nx build authentication --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3001
RUN npm i -g nodemon pg
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/dist/apps/authentication/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps typeorm
RUN chown -R node:node .
USER node
EXPOSE 3001
CMD ["dumb-init", "node", "main.js"]
