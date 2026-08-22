# Security

Security best practices for Go applications.

## HTTPS/TLS

```go
import "crypto/tls"

func main() {
    cfg := &tls.Config{
        MinVersion:               tls.VersionTLS12,
        CurvePreferences:         []tls.CurveID{tls.CurveP256, tls.X25519},
        PreferServerCipherSuites: true,
        CipherSuites: []uint16{
            tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
        },
    }

    server := &http.Server{
        Addr:      ":https",
        TLSConfig: cfg,
        Handler:   router,
    }

    server.ListenAndServeTLS("cert.pem", "key.pem")
}
```

## Headers

```go
import "github.com/go-chi/chi/v5/middleware"

func SecureHeaders(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("X-Frame-Options", "DENY")
        w.Header().Set("X-Content-Type-Options", "nosniff")
        w.Header().Set("X-XSS-Protection", "1; mode=block")
        w.Header().Set("Strict-Transport-Security", "max-age=31536000")
        next.ServeHTTP(w, r)
    })
}
```

## Input Validation

```go
import "github.com/go-playground/validator/v10"

func validateInput(data interface{}) error {
    validate := validator.New()
    return validate.Struct(data)
}

type RegisterInput struct {
    Email    string `validate:"required,email"`
    Password string `validate:"required,min=8"`
    Name     string `validate:"required,min=2,max=100"`
}
```

## SQL Injection

```go
// WRONG
query := fmt.Sprintf("SELECT * FROM users WHERE id = " + id)

// RIGHT - Parameterized
db.Query("SELECT * FROM users WHERE id = ?", id)

// RIGHT - sqlx
db.Get(&user, "SELECT * FROM users WHERE id = ?", id)
```

## Secrets

```go
import "os"

// Environment variables
apiKey := os.Getenv("API_KEY")

// Never hardcode secrets!
```

## Rate Limiting

```go
import "golang.org/x/time/rate"

func RateLimiter(next http.Handler) http.Handler {
    limiter := rate.NewLimiter(10, 20) // 10 req/sec, burst 20

    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !limiter.Allow() {
            http.Error(w, "Rate limited", http.StatusTooManyRequests)
            return
        }
        next.ServeHTTP(w, r)
    })
}
```

## Authentication

```go
import "golang.org/x/oauth2"

func OAuth() *oauth2.Config {
    return &oauth2.Config{
        ClientID:     os.Getenv("CLIENT_ID"),
        ClientSecret: os.Getenv("CLIENT_SECRET"),
        Scopes:       []string{"user:email"},
        Endpoint: oauth2.Endpoint{
            AuthURL:  "https://github.com/login/oauth/authorize",
            TokenURL: "https://github.com/login/oauth/access_token",
        },
    }
}
```

## Best Practices

1. **Always use HTTPS**
2. **Validate all input**
3. **Use parameterized queries**
4. **Never commit secrets**
5. **Implement rate limiting**
6. **Use secure headers**
7. **Keep dependencies updated**

## Code Playground

Secure your applications!
