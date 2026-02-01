FROM node:lts-alpine

# Install system dependencies
# postgresql-client: for create-dbs.sh (psql, pg_isready)
# git: often needed for npm install in some packages
# python3, make, g++: for native modules (node-gyp) if needed
RUN apk add --no-cache postgresql-client git python3 make g++

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application code
COPY . .

# Set the default command to run the setup script
CMD ["npm", "run", "db:setup"]
