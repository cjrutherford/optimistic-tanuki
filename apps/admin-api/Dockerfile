FROM golang:1.24-alpine AS go-builder
WORKDIR /src
COPY tools/admin-env-wizard/go.mod tools/admin-env-wizard/go.sum ./tools/admin-env-wizard/
WORKDIR /src/tools/admin-env-wizard
RUN go mod download
WORKDIR /src
COPY tools/admin-env-wizard ./tools/admin-env-wizard
WORKDIR /src/tools/admin-env-wizard
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/admin-env ./cmd/admin-env

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig*.json ./
COPY libs ./libs
COPY apps/admin-api ./apps/admin-api
COPY scripts ./scripts
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm exec nx build admin-api

FROM node:22-alpine
RUN apk add --no-cache docker-cli docker-cli-compose
WORKDIR /app
COPY --from=builder /app/dist/apps/admin-api/package.json ./package.json
COPY --from=builder /app/dist/apps/admin-api/pnpm-lock.yaml ./pnpm-lock.yaml
RUN corepack enable && corepack prepare pnpm@11.0.9 --activate && CI=true pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=builder /app/dist/apps/admin-api ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=go-builder /out/admin-env /usr/local/bin/admin-env
COPY --from=go-builder /out/admin-env ./tools/admin-env-wizard/admin-env
EXPOSE 8098
CMD ["node", "dist/main.js"]
