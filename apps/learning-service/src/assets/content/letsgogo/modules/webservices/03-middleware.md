# Middleware

Middleware are functions that wrap handlers to add common functionality like logging, authentication, or CORS.

## The Middleware Pattern

A middleware function has this signature:

```go
func Middleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Do something before
        next.ServeHTTP(w, r)
        // Do something after
    })
}
```

## Example: Logging Middleware

```go
func Logger(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()

        next.ServeHTTP(w, r)

        fmt.Printf("%s %s %v\n", r.Method, r.URL.Path, time.Since(start))
    })
}
```

## Example: Authentication

```go
func Auth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        token := r.Header.Get("Authorization")

        if token == "" {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }

        // Validate token...

        next.ServeHTTP(w, r)
    })
}
```

## Example: CORS

```go
func CORS(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Access-Control-Allow-Origin", "*")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }

        next.ServeHTTP(w, r)
    })
}
```

## Using Middleware

```go
func main() {
    r := chi.NewRouter()

    // Global middleware
    r.Use(Logger)
    r.Use(Recovery)
    r.Use(CORS)

    // Route-specific
    r.Group(func(r chi.Router) {
        r.Use(Auth)
        r.HandleFunc("/protected", protectedHandler)
    })
}
```

## Chaining Multiple Middleware

```go
func chain(h http.Handler, middlewares ...func(http.Handler) http.Handler) http.Handler {
    for i := len(middlewares) - 1; i >= 0; i-- {
        h = middlewares[i](h)
    }
    return h
}

// Usage
handler := chain(baseHandler, Logger, Auth, CORS)
```

## Middleware with Data

Pass data to handlers via context:

```go
func UserContext(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        userID := getUserFromToken(r.Header.Get("Authorization"))

        ctx := context.WithValue(r.Context(), "userID", userID)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

func handler(w http.ResponseWriter, r *http.Request) {
    userID := r.Context().Value("userID").(string)
    fmt.Fprintf(w, "User: %s", userID)
}
```

## Panic Recovery

```go
func Recovery(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        defer func() {
            if err := recover(); err != nil {
                fmt.Printf("Panic: %v\n", err)
                http.Error(w, "Internal Server Error", http.StatusInternalServerError)
            }
        }()
        next.ServeHTTP(w, r)
    })
}
```

## Response Timeouts

```go
import "github.com/go-chi/chi/v5/middleware"

func Timeout(timeout time.Duration) func(http.Handler) http.Handler {
    return middleware.Timeout(timeout)
}

// Usage
r.Use(Timeout(5 * time.Second))
```

## Best Practices

1. **Keep middleware focused** - Do one thing well
2. **Order matters** - Put general middleware first
3. **Use context** - Pass data via context, not globals
4. **Handle panics** - Always recover in middleware
5. **Document side effects** - Note what your middleware does

## Code Playground

Try implementing middleware!
