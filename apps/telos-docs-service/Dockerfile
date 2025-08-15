# Install dependencies only when needed
FROM docker.io/node:lts-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /usr/src/app
COPY dist/apps/telos-docs-service/package*.json ./
RUN npm install --omit=dev && npm i --save pg

# Production image, copy all the files and run nest
FROM docker.io/node:lts-alpine AS runner
RUN apk add --no-cache dumb-init
ENV NODE_ENV=production
ENV PORT=3008
WORKDIR /usr/src/app
RUN npm i -g nodemon pg
COPY --from=deps /usr/src/app/node_modules ./node_modules
COPY --from=deps /usr/src/app/package.json ./package.json
COPY dist/apps/telos-docs-service .
RUN chown -R node:node .
USER node
EXPOSE 3008
CMD ["dumb-init", "node", "main.js"]
