# Stage 1: Build the Angular SSR application
FROM node:lts-alpine as builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/configurable-client ./apps/configurable-client

# Install all dependencies (including devDependencies needed for build)
RUN corepack enable && pnpm install --frozen-lockfile

# Build the configurable-client application for production with SSR
RUN pnpm exec nx build configurable-client --configuration=production

# Stage 2: Create the runtime image from a slim Node.js base
FROM node:lts-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set NODE_ENV to production for the runtime environment
ENV NODE_ENV=production

# Copy package.json and package-lock.json again to install only production dependencies
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

# Install only production dependencies.
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Copy the built application (server and browser bundles) from the builder stage
COPY --from=builder /usr/src/app/dist/apps/configurable-client ./dist/apps/configurable-client

# Expose the port the SSR server will listen on.
EXPOSE 4000

# Command to run the SSR server.
CMD ["node", "/app/dist/apps/configurable-client/server/server.mjs"]
