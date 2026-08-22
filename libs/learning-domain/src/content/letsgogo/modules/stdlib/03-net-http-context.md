# net/http and Context

Building HTTP clients and servers with context for cancellation.

## Using Context

Context allows cancellation and deadlines:

```go
import "context"

func main() {
    ctx := context.Background()

    // With timeout
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    // With cancellation
    ctx, cancel := context.WithCancel(context.Background())

    // Do work
    result, err := doWork(ctx)

    // Cancel
    cancel()
}
```

## HTTP Server with Context

```go
func handler(w http.ResponseWriter, r *http.Request) {
    // Get context from request
    ctx := r.Context()

    // Check for timeout
    select {
    case <-ctx.Done():
        http.Error(w, "Timeout", http.StatusRequestTimeout)
        return
    default:
    }

    // Use context in downstream calls
    result, err := fetchData(ctx, "api")

    // Respond
    json.NewEncoder(w).Encode(result)
}
```

## HTTP Client

```go
func main() {
    client := &http.Client{}

    ctx := context.WithValue(context.Background(),
        "authToken", "secret")

    req, _ := http.NewRequestWithContext(ctx,
        "GET", "http://api.example.com/data", nil)

    resp, err := client.Do(req)
    // ...
}
```

## Middleware with Context

```go
func TimeoutMiddleware(timeout time.Duration) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ctx, cancel := context.WithTimeout(r.Context(), timeout)
            defer cancel()

            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}
```

## Context Values

```go
// Set value
ctx := context.WithValue(context.Background(), "userID", "123")

// Get value
userID := ctx.Value("userID").(string)
```

## Common Patterns

### Request ID

```go
func RequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        reqID := uuid.New().String()
        ctx := context.WithValue(r.Context(), "requestID", reqID)

        w.Header().Set("X-Request-ID", reqID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

### Tracing

```go
func Tracing(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Start span
        ctx, span := otel.Tracer("myapp").Start(r.Context(), r.URL.Path)
        defer span.End()

        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

## Best Practices

1. **Pass context** to all blocking operations
2. **Use context.Background** for top-level
3. **Don't store context in structs**
4. **Check ctx.Done()** in long operations
5. **Set timeouts** for external calls

## Code Playground

Use context in your HTTP servers!
