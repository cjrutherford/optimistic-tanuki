# Table-Driven Tests

Table-driven tests are a Go idiom for writing clean, maintainable tests.

## Basic Structure

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive numbers", 2, 3, 5},
        {"negative numbers", -1, -1, -2},
        {"zero", 0, 0, 0},
        {"mixed", -5, 10, 5},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            result := Add(tt.a, tt.b)
            if result != tt.expected {
                t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, result, tt.expected)
            }
        })
    }
}
```

## Why Table-Driven?

- **Readable**: Test cases are clearly visible
- **Extensible**: Add cases easily
- **Maintainable**: Single source of truth
- **Parallel**: Can run subtests in parallel

## Subtests

Each table entry becomes a subtest:

```bash
=== RUN   TestAdd/positive_numbers
--- PASS: TestAdd/positive_numbers (0.00s)
=== RUN   TestAdd/negative_numbers
--- PASS: TestAdd/negative_numbers (0.00s)
```

## Advanced Patterns

### Error Testing

```go
func TestDivide(t *testing.T) {
    tests := []struct {
        name        string
        dividend    float64
        divisor     float64
        expectError bool
    }{
        {"normal", 10, 2, false},
        {"zero divisor", 10, 0, true},
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            _, err := Divide(tt.dividend, tt.divisor)
            if (err != nil) != tt.expectError {
                t.Errorf("Divide() error = %v; want error = %v", err, tt.expectError)
            }
        })
    }
}
```

### Setup and Teardown

```go
func TestDatabase(t *testing.T) {
    tests := []struct {
        name    string
        setup   func() *DB
        query   func(*DB) error
    }{
        {
            name: "create user",
            setup: func() *DB { return NewDB() },
            query: func(db *DB) error { return db.CreateUser("alice") },
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            db := tt.setup()
            defer db.Close()

            if err := tt.query(db); err != nil {
                t.Errorf("query failed: %v", err)
            }
        })
    }
}
```

## Best Practices

1. **Use descriptive names** for test cases
2. **Group related tests** in tables
3. **Test edge cases**: zero, negative, max values
4. **Test errors** alongside happy paths
5. **Keep tables focused** - one table per behavior

## Code Playground

Write table-driven tests for the functions you've learned about!
