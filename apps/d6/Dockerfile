# Stage 1: Build the Angular SSR application
FROM node:lts-alpine as builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install --legacy-peer-deps

# Copy the entire workspace source code
# Nx needs this to build the application and its dependencies
COPY . .

# Build the d6 application for production with SSR
# This will output to dist/apps/d6 and include server/main.js
RUN npx nx build d6 --configuration=production

# Stage 2: Create the runtime image from a slim Node.js base
FROM node:lts-alpine
RUN apk add --no-cache dumb-init

WORKDIR /app

# Set NODE_ENV to production for the runtime environment
ENV NODE_ENV=production

# Copy package.json and package-lock.json again to install only production dependencies
COPY --from=builder /usr/src/app/package.json ./
COPY --from=builder /usr/src/app/package-lock.json ./

# Install only production dependencies.
RUN npm install --omit=dev --legacy-peer-deps && npm i -g nodemon @angular/cli

# Copy the built application (server and browser bundles) from the builder stage
# The structure should be dist/apps/d6/server/main.js and dist/apps/d6/browser/...
COPY --from=builder /usr/src/app/dist/apps/d6 ./dist/apps/d6

# Expose the port the SSR server will listen on.
# Angular Universal apps often default to 4000 or use process.env.PORT.
# Check your apps/d6/src/server.ts for the actual port.
EXPOSE 4000

# Command to run the SSR server.
# The entry point is typically dist/apps/d6/server/main.js.
CMD ["node", "/app/dist/apps/d6/server/server.mjs"]
