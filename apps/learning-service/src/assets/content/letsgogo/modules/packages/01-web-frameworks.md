# Web Frameworks

Go has several popular web frameworks for building APIs and web applications.

## gin (Most Popular)

```bash
go get github.com/gin-gonic/gin
```

```go
import "github.com/gin-gonic/gin"

func main() {
    r := gin.Default()

    r.GET("/ping", func(c *gin.Context) {
        c.JSON(200, gin.H{"message": "pong"})
    })

    r.Run()
}
```

### Router Groups

```go
v1 := r.Group("/api/v1")
{
    v1.GET("/users", getUsers)
    v1.POST("/users", createUser)
}
```

### Binding

```go
type Login struct {
    User     string `form:"user" json:"user" binding:"required"`
    Password string `form:"password" json:"password" binding:"required"`
}

func login(c *gin.Context) {
    var l Login
    if err := c.ShouldBindJSON(&l); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    // ...
}
```

## chi (Lightweight)

```bash
go get github.com/go-chi/chi/v5
```

```go
import "github.com/go-chi/chi/v5"

func main() {
    r := chi.NewRouter()
    r.Get("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hello"))
    })
    http.ListenAndServe(":3000", r)
}
```

## echo (Fast)

```bash
go get github.com/labstack/echo/v4
```

```go
import "github.com/labstack/echo/v4"

func main() {
    e := echo.New()
    e.GET("/hello", func(c echo.Context) error {
        return c.String(200, "Hello")
    })
    e.Start(":1323")
}
```

## fiber (Express-like)

```bash
go get github.com/gofiber/fiber/v2
```

```bash
go get github.com/gofiber/fiber/v2

func main() {
    app := fiber.New()

    app.Get("/", func(c *fiber.Ctx) error {
        return c.SendString("Hello!")
    })

    app.Listen(":3000")
}
```

## Comparison

| Framework | Stars | Performance    | Features             |
| --------- | ----- | -------------- | -------------------- |
| gin       | 75k+  | Very High      | Middleware, binding  |
| chi       | 25k+  | High           | Lightweight, routing |
| echo      | 25k+  | Very High      | HTTP/2, TLS          |
| fiber     | 30k+  | Extremely High | Express-like API     |

## Recommendation

- **gin** - Best all-around, great ecosystem
- **chi** - When you need lightweight
- **fiber** - Coming from Express.js
- **echo** - When you need HTTP/2

## Code Playground

Try building an API with gin!
