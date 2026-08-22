# fmt, strings, strconv

The most commonly used packages in Go's standard library.

## fmt Package

### Print functions

```go
import "fmt"

// Print without newline
fmt.Print("Hello", "World")

// Print with newline
fmt.Println("Hello", "World")

// Printf - formatted
name := "Alice"
fmt.Printf("Hello, %s!\n", name)
```

### Format verbs

```go
// Basic
%v    // Value in default format
%T    // Type of value
%%    // Literal percent

// Strings
%s    // String
%q    // Quoted string
%x    // Hex encoding

// Integers
%d    // Decimal
%x    // Hex
%o    // Octal
%b    // Binary

// Floats
%f    // Decimal point
%e    // Scientific notation
%.2f  // 2 decimal places

// Pointers
%p    // Pointer address
```

### StringBuilder

```go
var sb strings.Builder
sb.WriteString("Hello")
sb.WriteString(" ")
sb.WriteString("World")
fmt.Println(sb.String()) // "Hello World"
```

## strings Package

### Common functions

```go
import "strings"

// Case conversion
strings.ToLower("HELLO")  // "hello"
strings.ToUpper("hello")  // "HELLO"
strings.Title("hello world") // "Hello World"

// Search
strings.Contains("hello world", "world")  // true
strings.HasPrefix("filename.txt", "file") // true
strings.HasSuffix("filename.txt", ".txt") // true
strings.Index("hello", "l")              // 2

// Split and join
parts := strings.Split("a,b,c", ",")     // ["a","b","c"]
joined := strings.Join(parts, "-")        // "a-b-c"

// Trim
strings.Trim("  hello  ", " ")           // "hello"
strings.TrimSpace("  hello  ")          // "hello"

// Replace
strings.ReplaceAll("foo bar", "o", "x") // "fxx bar"

// Builder (efficient)
var b strings.Builder
b.WriteString("Hello")
```

## strconv Package

### Converting strings

```go
import "strconv"

// String to int
i, err := strconv.Atoi("42")    // int, error
i, err := strconv.ParseInt("42", 10, 64)

// String to float
f, err := strconv.ParseFloat("3.14", 64)

// Int to string
s := strconv.Itoa(42)           // "42"
s := strconv.FormatInt(42, 10)  // "42"

// Float to string
s := strconv.FormatFloat(3.14, 'f', 2, 64) // "3.14"

// Bool to string
s := strconv.FormatBool(true)   // "true"

// String to bool
b, err := strconv.ParseBool("true") // true, nil
```

### Common patterns

```go
// Safe conversion with default
func parseInt(s string, defaultVal int) int {
    i, err := strconv.Atoi(s)
    if err != nil {
        return defaultVal
    }
    return i
}

// Environment variables
port, _ := strconv.Atoi(os.Getenv("PORT"))
if port == 0 {
    port = 8080
}
```

## time Package

```go
import "time"

// Current time
now := time.Now()

// Parsing
t, err := time.Parse("2006-01-02", "2024-01-15")

// Formatting
t.Format("January 2, 2006")

// Durations
time.Second * 30    // 30 seconds
time.Minute * 5     // 5 minutes

// Sleep
time.Sleep(time.Second)

// Ticker
ticker := time.NewTicker(time.Second)
defer ticker.Stop()
```

## Best Practices

1. Use `strings.Builder` for multiple string concatenations
2. Always handle errors from strconv functions
3. Use `fmt.Fprintf` for writing to io.Writers
4. Prefer `strconv.Atoi` for simple cases, `ParseInt` for specific bases

## Code Playground

Experiment with these functions!
