FROM golang:1.24-alpine AS builder

WORKDIR /src

COPY tools/admin-env-wizard/go.mod tools/admin-env-wizard/go.sum ./tools/admin-env-wizard/
WORKDIR /src/tools/admin-env-wizard
RUN go mod download

WORKDIR /src
COPY tools/admin-env-wizard ./tools/admin-env-wizard
COPY ops ./ops

WORKDIR /src/tools/admin-env-wizard
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/admin-env ./cmd/admin-env

FROM alpine:3.22

WORKDIR /app

COPY --from=builder /out/admin-env /usr/local/bin/admin-env
COPY --from=builder /src/ops /app/ops

EXPOSE 8098

ENV ADMIN_ENV_DEPLOYMENT_PATH=/app/ops/deployments/production.yaml
ENV ADMIN_ENV_ADDRESS=:8098

CMD ["admin-env", "serve"]
