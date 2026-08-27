# Deployment

Deploying Go applications to production.

## Building

```bash
# Standard build
go build -o myapp

# Cross-compilation
GOOS=linux GOARCH=amd64 go build -o myapp-linux
GOOS=windows GOARCH=amd64 go build -o myapp.exe
GOOS=darwin GOARCH=amd64 go build -o myapp-macos

# For small Docker images
go build -ldflags="-s -w" -o myapp

# Version info
go build -ldflags="-X main.version=1.0.0" -o myapp
```

## Docker

### Minimal Dockerfile

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN CGO_ENABLED=0 go build -o myapp

# Runtime stage
FROM alpine:3.18
RUN apk --no-cache add ca-certificates
WORKDIR /app
COPY --from=builder /app/myapp .
EXPOSE 8080
CMD ["./myapp"]
```

### Multi-stage for smaller images

```dockerfile
# Use scratch for smallest image
FROM golang:1.21-alpine AS builder
WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o myapp

FROM scratch
COPY --from=builder /build/myapp .
EXPOSE 8080
CMD ["./myapp"]
```

## Docker Compose

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - '8080:8080'
    environment:
      - DATABASE_URL=postgres://user:pass@db:5432/myapp
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: myapp
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes: postgres_data
```

## Cloud Platforms

### Railway

```bash
# Deploy with CLI
railway init
railway deploy
```

### Render

```bash
# Connect GitHub repo
# Render auto-detects Go
```

### Fly.io

```bash
fly launch
fly deploy
```

## Health Checks

```go
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}

func readyHandler(w http.ResponseWriter, r *http.Request) {
    if db.Ping() != nil {
        http.Error(w, "DB not ready", http.StatusServiceUnavailable)
        return
    }
    w.WriteHeader(http.StatusOK)
    w.Write([]byte("OK"))
}
```

### Docker health check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/health || exit 1
```

## Graceful Shutdown

```go
func main() {
    server := &http.Server{Addr: ":8080"}

    go func() {
        if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatal(err)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    if err := server.Shutdown(ctx); err != nil {
        log.Fatal(err)
    }
}
```

## CI/CD Example (GitHub Actions)

```yaml
name: Deploy
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.21'
      - run: go test ./...
      - run: go build -o myapp
```

## Best Practices

1. **Use multi-stage Docker builds**
2. **Implement health checks**
3. **Handle graceful shutdown**
4. **Use environment variables**
5. **Set resource limits in Kubernetes**

## Code Playground

Build and deploy your app!
