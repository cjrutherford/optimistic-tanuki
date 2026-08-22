# Testing in Go

Go has a built-in testing package that's simple yet powerful. Let's explore how to write effective tests.

## Basic Test

```go
package main

import "testing"

// Test files end with _test.go
// Test functions start with Test

func TestAdd(t *testing.T) {
    result := Add(2, 3)
    expected := 5

    if result != expected {
        t.Errorf("Add(2, 3) = %d; want %d", result, expected)
    }
}
```

## Running Tests

```bash
go test ./...              # Run all tests
go test -v                 # Verbose output
go test -run TestName      # Run specific test
go test -cover             # Show coverage
go test -bench=.           # Run benchmarks
go test -race              # Check for race conditions
```

## Test Files

```
calculator.go      # Implementation
calculator_test.go # Tests
```

Both in same package:

```go
package main // or package calculator
```

## Assertions

Go has no built-in assertions - use plain checks:

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        a, b, want int
    }{
        {1, 2, 3},
        {0, 0, 0},
        {-1, 1, 0},
    }

    for _, tt := range tests {
        got := Add(tt.a, tt.b)
        if got != tt.want {
            t.Errorf("Add(%d, %d) = %d; want %d", tt.a, tt.b, got, tt.want)
        }
    }
}
```

## Helper Methods

```go
func assertEqual(t *testing.T, got, want interface{}) {
    if got != want {
        t.Fatalf("got %v, want %v", got, want)
    }
}

func TestAdd(t *testing.T) {
    assertEqual(t, Add(2, 3), 5)
}
```

## TestMain

For setup/teardown:

```go
func TestMain(m *testing.M) {
    // Setup
    setup()
    code := m.Run()
    // Teardown
    teardown()
    os.Exit(code)
}
```

## Table-Driven Tests

```go
func TestAdd(t *testing.T) {
    tests := []struct {
        name     string
        a, b     int
        expected int
    }{
        {"positive", 2, 3, 5},
        {"negative", -1, 1, 0},
        {"zero", 0, 0, 0},
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

Output:

```
=== RUN   TestAdd/positive
--- PASS: TestAdd/positive (0.00s)
=== RUN   TestAdd/negative
--- PASS: TestAdd/negative (0.00s)
=== RUN   TestAdd/zero
--- PASS: TestAdd/zero (0.00s)
```

## Subtests

```go
func TestMath(t *testing.T) {
    t.Run("Add", func(t *testing.T) {
        if Add(1, 2) != 3 {
            t.Fail()
        }
    })

    t.Run("Multiply", func(t *testing.T) {
        if Multiply(2, 3) != 6 {
            t.Fail()
        }
    })
}
```

## Skipping Tests

```go
func TestSlow(t *testing.T) {
    if testing.Short() {
        t.Skip("Skipping in short mode")
    }
    // Long test...
}
```

## T.Parallel

```go
func TestConcurrent(t *testing.T) {
    t.Parallel() // Run in parallel with other parallel tests
    // Test code...
}
```

## Error Types in Tests

```go
func TestErrorTypes(t *testing.T) {
    err := doSomething()

    // Check error type
    var perr *os.PathError
    if errors.As(err, &perr) {
        t.Logf("Path error: %s", perr.Path)
    }

    // Check error content
    if !errors.Is(err, os.ErrNotExist) {
        t.Errorf("expected not found error, got %v", err)
    }
}
```

## Testing with Cleanup

```go
func TestWithCleanup(t *testing.T) {
    // Create temp file
    f, err := os.CreateTemp("", "test")
    if err != nil {
        t.Fatal(err)
    }

    // Clean up after test
    t.Cleanup(func() {
        os.Remove(f.Name())
    })

    // Test code using f...
}
```

## Code Playground

Write and run tests to see them pass or fail!
