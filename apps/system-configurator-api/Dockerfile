FROM docker.io/node:lts-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY package*.json tsconfig*.json nx.json ./
COPY libs/ ./libs/
COPY apps/system-configurator-api/ ./apps/system-configurator-api/
RUN npm install --legacy-peer-deps
RUN npx nx build system-configurator-api --configuration=development

FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3021
WORKDIR /usr/src/app
RUN npm i -g nodemon pg
COPY --from=builder /usr/src/app/dist/apps/system-configurator-api/ ./
RUN npm install --omit=dev --legacy-peer-deps
RUN npm i --save --legacy-peer-deps @nestjs/typeorm typeorm pg reflect-metadata
RUN chown -R node:node .
USER node
EXPOSE 3021
CMD ["dumb-init", "node", "main.js"]
