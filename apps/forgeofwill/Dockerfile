# Stage 1: Build the Angular SSR application
FROM node:lts-alpine as builder

# Set working directory
WORKDIR /usr/src/app

ARG GIT_SHA=unknown

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/forgeofwill ./apps/forgeofwill

# Install all dependencies (including devDependencies needed for build)
RUN npm install --legacy-peer-deps

# Build the forgeofwill application for production with SSR
# This will output to dist/apps/forgeofwill and include server/main.js
RUN npx nx build forgeofwill --configuration=production

# Stage 2: Create the runtime image from a slim Node.js base
FROM node:lts-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

ARG GIT_SHA=unknown

# Set NODE_ENV to production for the runtime environment
ENV NODE_ENV=production
ENV GIT_SHA=${GIT_SHA}

# Copy package.json and package-lock.json again to install only production dependencies
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/package-lock.json ./

# Install only production dependencies.
RUN npm install --omit=dev --legacy-peer-deps && npm i -g nodemon

# Copy the built application (server and browser bundles) from the builder stage
# The structure should be dist/apps/forgeofwill/server/main.js and dist/apps/forgeofwill/browser/...
COPY --from=builder /usr/src/app/dist/apps/forgeofwill ./dist/apps/forgeofwill

# Create startup script to inject dev env vars
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && \
    echo 'if [ "$NODE_ENV" = "development" ]; then' >> /docker-entrypoint.sh && \
    echo '  STARTUP_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")' >> /docker-entrypoint.sh && \
    echo '  for f in $(find /app/dist/apps/forgeofwill/browser -name "index.html"); do' >> /docker-entrypoint.sh && \
    echo '    sed -i "s|<head>|<head><script>window.__env__ = { GIT_SHA: \"$GIT_SHA\", STARTUP_TIME: \"$STARTUP_TIME\", NODE_ENV: \"$NODE_ENV\" };</script>|g" "$f"' >> /docker-entrypoint.sh && \
    echo '  done' >> /docker-entrypoint.sh && \
    echo 'fi' >> /docker-entrypoint.sh && \
    echo 'exec "$@"' >> /docker-entrypoint.sh && \
    chmod +x /docker-entrypoint.sh

EXPOSE 4000

ENTRYPOINT ["/docker-entrypoint.sh"]

# Command to run the SSR server.
# The entry point is typically dist/apps/forgeofwill/server/main.js.
CMD ["node", "/app/dist/apps/forgeofwill/server/server.mjs"]
