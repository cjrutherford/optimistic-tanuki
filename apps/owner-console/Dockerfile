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

# Build the owner-console application for production
RUN npx nx build owner-console --configuration=production

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy the built application from the builder stage
COPY --from=builder /usr/src/app/dist/apps/owner-console/browser /usr/share/nginx/html

# Copy nginx configuration if needed
COPY apps/owner-console/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
