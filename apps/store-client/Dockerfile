# Stage 1: Build the Angular application
FROM node:lts-alpine as builder

# Set working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package.json ./
COPY package-lock.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm ci --legacy-peer-deps

# Copy the entire workspace source code
# Nx needs this to build the application and its dependencies
COPY . .

# Build the store-client application for production
RUN npx nx build store-client --configuration=production

# Stage 2: Create the runtime image with nginx to serve static files
FROM nginx:alpine

# Copy built application from builder stage
COPY --from=builder /usr/src/app/dist/apps/store-client/browser /usr/share/nginx/html

# Copy custom nginx configuration if needed
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 4000

# Command to run nginx
CMD ["nginx", "-g", "daemon off;"]
