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

    // A context carries cancellation and deadlines. Credentials go in a
    // header, where the server will actually look for them.
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()

    req, _ := http.NewRequestWithContext(ctx,
        "GET", "http://api.example.com/data", nil)
    req.Header.Set("Authorization", "Bearer "+token)

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

Context values are keyed by an empty interface, so any type can be a key. That
makes it tempting to use a plain string:

```go
// Don't do this. staticcheck reports it as SA1029; go vet does not catch it,
// so a clean `go vet` is not evidence that your context keys are safe.
ctx := context.WithValue(context.Background(), "userID", "123")
userID := ctx.Value("userID").(string)
```

The problem is that string keys collide silently. Your context travels through
middleware you wrote, middleware from a router, and library code you have never
read. If any of them also stores `"userID"`, one of you overwrites the other,
and nothing reports it: no compile error, no panic, just the wrong user.

Define an unexported key type instead. Because the type is unexported, no other
package can construct a value of it, so no other package can collide with you
even if it picks the same underlying number.

```go
// The type is unexported, so these keys are unforgeable outside this package.
type contextKey int

const (
    userIDKey contextKey = iota
    requestIDKey
)

// Store through a helper, so the key never leaks.
func WithUserID(ctx context.Context, userID string) context.Context {
    return context.WithValue(ctx, userIDKey, userID)
}

// Read through a helper too, and return the comma-ok rather than asserting.
// A missing value is normal: it means this request did not come through the
// middleware that sets it.
func UserID(ctx context.Context) (string, bool) {
    userID, ok := ctx.Value(userIDKey).(string)
    return userID, ok
}
```

A bare `ctx.Value(k).(string)` panics when the value is absent or is some other
type. The two-result form cannot.

Context values are for data that belongs to the request and crosses API
boundaries: a request ID, an authenticated user, a trace span. They are not a
way to pass ordinary arguments. If a function needs a value to do its job, give
it a parameter, where the compiler can check it.

## Common Patterns

### Request ID

```go
func RequestID(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        reqID := uuid.New().String()
        ctx := context.WithValue(r.Context(), requestIDKey, reqID)

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
