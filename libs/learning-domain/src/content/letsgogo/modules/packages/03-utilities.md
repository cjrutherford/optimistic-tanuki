# Utilities

Essential third-party packages for common tasks.

## Configuration

### Viper

```bash
go get github.com/spf13/viper
```

```go
import "github.com/spf13/viper"

func main() {
    viper.SetConfigName("config") // config.yaml
    viper.AddConfigPath(".")
    viper.ReadInConfig()

    // Access values
    dbHost := viper.GetString("database.host")
    dbPort := viper.GetInt("database.port")

    // With defaults
    viper.SetDefault("port", 8080)
}
```

### envconfig

```bash
go get github.com/kelseyhightower/envconfig
```

```go
import "github.com/kelseyhightower/envconfig"

type Config struct {
    Port        int    `envconfig:"PORT"`
    DatabaseURL string `envconfig:"DATABASE_URL"`
    Debug       bool   `envconfig:"DEBUG"`
}

func main() {
    var config Config
    envconfig.Process("myapp", &config)
}
```

## Logging

### Zap

```bash
go get go.uber.org/zap
```

```go
import "go.uber.org/zap"

func main() {
    logger, _ := zap.NewProduction()
    defer logger.Sync()

    logger.Info("hello",
        zap.String("field", "value"),
        zap.Int("count", 42),
    )
}
```

### logrus

```bash
go get github.com/sirupsen/logrus
```

```go
import "github.com/sirupsen/logrus"

func main() {
    logrus.SetFormatter(&logrus.JSONFormatter{})
    logrus.SetLevel(logrus.InfoLevel)

    logrus.Info("hello world")
}
```

## CLI

### Cobra

```bash
go get github.com/spf13/cobra
```

```go
import "github.com/spf13/cobra"

func main() {
    var name string

    cmd := &cobra.Command{
        Use:   "hello [name]",
        Short: "Say hello",
        Run: func(cmd *cobra.Command, args []string) {
            if name == "" {
                name = "World"
            }
            fmt.Printf("Hello, %s!\n", name)
        },
    }

    cmd.Flags().StringVarP(&name, "name", "n", "", "Name to greet")

    cmd.Execute()
}
```

## Validation

### go-playground/validator

```bash
go get github.com/go-playground/validator/v10
```

```go
import "github.com/go-playground/validator/v10"

type User struct {
    Name  string `validate:"required,min=2,max=50"`
    Email string `validate:"required,email"`
    Age   int    `validate:"gte=0,lte=150"`
}

func main() {
    validate := validator.New()

    user := User{Name: "A", Email: "invalid"}

    err := validate.Struct(user)
    if err != nil {
        for _, err := range err.(validator.ValidationErrors) {
            fmt.Println(err.Field(), err.Tag())
        }
    }
}
```

## UUID

```bash
go get github.com/google/uuid
```

```go
import "github.com/google/uuid"

func main() {
    id := uuid.New()
    fmt.Println(id)

    // Parse
    id, err := uuid.Parse("550e8400-e29b-41d4-a716-446655440000")
}
```

## Summary

| Category   | Package                   | Use Case              |
| ---------- | ------------------------- | --------------------- |
| Config     | spf13/viper               | YAML/JSON/env config  |
| Config     | kelseyhightower/envconfig | Environment variables |
| Logging    | uber/zap                  | Structured logging    |
| CLI        | spf13/cobra               | Command-line apps     |
| Validation | go-playground/validator   | Input validation      |
| UUID       | google/uuid               | Unique IDs            |

## Code Playground

Try these utilities!
