# Error Handling

If there's one thing that surprises TypeScript developers most about Go, it's the error handling. Gone are try-catch blocks—in Go, errors are just values.

## The Go Way

In TypeScript, you'd handle errors like this:

```typescript
async function fetchUser(id: number): Promise<User> {
  try {
    const response = await fetch(`/api/users/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch user');
    }
    return await response.json();
  } catch (error) {
    console.error(error);
    throw error;
  }
}
```

In Go, errors are returned explicitly:

```go
func fetchUser(id int) (*User, error) {
    resp, err := http.Get(fmt.Sprintf("/api/users/%d", id))
    if err != nil {
        return nil, fmt.Errorf("failed to fetch user: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("failed to fetch user: status %d", resp.StatusCode)
    }

    var user User
    if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
        return nil, fmt.Errorf("failed to decode user: %w", err)
    }

    return &user, nil
}
```

## Creating Errors

### Using fmt.Errorf

```go
import "fmt"

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, fmt.Errorf("division by zero")
    }
    return a / b, nil
}
```

### Using errors.New (for static messages)

```go
import "errors"

var ErrDivisionByZero = errors.New("division by zero")

func divide(a, b float64) (float64, error) {
    if b == 0 {
        return 0, ErrDivisionByZero
    }
    return a / b, nil
}
```

### Using sentinel errors

```go
var (
    ErrNotFound      = errors.New("not found")
    ErrUnauthorized = errors.New("unauthorized")
    ErrForbidden     = errors.New("forbidden")
)
```

## Error Wrapping

The `%w` verb wraps errors for context:

```go
func fetchUser(id int) (*User, error) {
    resp, err := http.Get(fmt.Sprintf("/api/users/%d", id))
    if err != nil {
        return nil, fmt.Errorf("fetching user %d: %w", id, err)
    }
    // ...
}

// Later:
func handleError(err error) {
    if errors.Is(err, context.DeadlineExceeded) {
        // Handle timeout
    }
    if errors.As(err, &MyCustomError{}) {
        // Handle custom error
    }
}
```

## The Error Interface

```go
type error interface {
    Error() string
}
```

You can implement your own error types:

```go
type ValidationError struct {
    Field   string
    Message string
}

func (e *ValidationError) Error() string {
    return fmt.Sprintf("%s: %s", e.Field, e.Message)
}
```

## Best Practices

1. **Handle every error** - No `try-catch` means you can't ignore errors accidentally
2. **Wrap errors with context** - Use `%w` to preserve the error chain
3. **Use sentinel errors** for known error conditions
4. **Don't panic for expected errors** - Return errors, only panic for truly exceptional situations
5. **Check errors early** - The "happy path" should indent less:

```go
if err != nil {
    return nil, err
}
// Normal code follows at no indent
```

## Common Patterns

### Named return values

```go
func divide(a, b float64) (result float64, err error) {
    if b == 0 {
        err = errors.New("division by zero")
        return
    }
    result = a / b
    return // or return a/b, nil
}
```

### Error variables

```go
var (
    errBadRequest = errors.New("bad request")
    errNotFound   = errors.New("not found")
)

func validate(id int) error {
    if id <= 0 {
        return errBadRequest
    }
    return nil
}
```

## Code Playground

Try implementing functions with proper error handling!
