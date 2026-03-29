FROM node:lts-alpine as builder

WORKDIR /usr/src/app

ARG GIT_SHA=unknown

COPY package.json ./
COPY package-lock.json ./

RUN npm install --legacy-peer-deps

COPY . .

RUN npx nx build leads-app --configuration=production

FROM node:lts-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

ARG GIT_SHA=unknown

ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}

COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/package-lock.json ./

RUN npm install --omit=dev --legacy-peer-deps && npm i -g nodemon

COPY --from=builder /usr/src/app/dist/apps/leads-app ./dist/apps/leads-app

RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'if [ "$NODE_ENV" = "development" ]; then' >> /docker-entrypoint.sh && \
    echo '  STARTUP_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")' >> /docker-entrypoint.sh && \
    echo '  for f in $(find /app/dist/apps/leads-app/browser -name "index.html"); do' >> /docker-entrypoint.sh && \
    echo '    sed -i "s|<head>|<head><script>window.__env__ = { GIT_SHA: \"$GIT_SHA\", STARTUP_TIME: \"$STARTUP_TIME\", NODE_ENV: \"$NODE_ENV\" };</script>|g" "$f"' >> /docker-entrypoint.sh && \
    echo '  done' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'exec "$@"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]

CMD ["node", "/app/dist/apps/leads-app/server/server.mjs"]
