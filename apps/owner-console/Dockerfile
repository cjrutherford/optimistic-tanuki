# Stage 1: Build the Angular SSR application
FROM node:lts-alpine as builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and pnpm-lock.yaml
COPY package.json ./
COPY pnpm-lock.yaml ./
COPY pnpm-workspace.yaml ./
COPY tsconfig*.json ./
COPY nx.json ./
COPY libs ./libs
COPY apps/owner-console ./apps/owner-console

# Install all dependencies (including devDependencies needed for build)
RUN corepack enable && pnpm install --frozen-lockfile

# Build the owner-console application for production with SSR
# This will output to dist/apps/owner-console and include server/main.js
RUN pnpm exec nx build owner-console --configuration=production

# Stage 2: Create the runtime image from a slim Node.js base
FROM node:lts-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set NODE_ENV to production for the runtime environment
ENV NODE_ENV=production

# Copy package.json and pnpm-lock.yaml again to install only production dependencies
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/pnpm-lock.yaml ./
COPY --from=builder /usr/src/app/pnpm-workspace.yaml ./

# Install only production dependencies.
RUN corepack enable && pnpm install --prod --frozen-lockfile

# Copy the built application (server and browser bundles) from the builder stage
# The structure should be dist/apps/owner-console/server/main.js and dist/apps/owner-console/browser/...
COPY --from=builder /usr/src/app/dist/apps/owner-console ./dist/apps/owner-console

# Expose the port the SSR server will listen on
EXPOSE 4000

# Command to run the SSR server
CMD ["node", "/app/dist/apps/owner-console/server/server.mjs"]
