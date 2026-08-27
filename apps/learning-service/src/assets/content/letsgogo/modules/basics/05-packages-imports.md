# Packages & Imports

Go organizes code into packages. Understanding this is key to writing idiomatic Go.

## Package Declaration

Every Go file starts with a package declaration:

```go
package main
```

### Types of Packages

1. **Executable packages** - must be `package main` and contain a `main()` function
2. **Library packages** - reusable code that can be imported

## Importing Packages

### Single Import

```go
import "fmt"

func main() {
    fmt.Println("Hello")
}
```

### Multiple Imports (Factorized)

```go
import (
    "fmt"
    "math"
    "strings"
)
```

## Standard Library Packages

Go comes with a rich standard library:

```go
import (
    "fmt"       // Formatting I/O
    "strings"   // String manipulation
    "strconv"   // String conversions
    "os"        // Operating system
    "time"      // Time and dates
    "json"      // JSON encoding/decoding
    "http"      // HTTP client/server
)
```

## Using Package Members

### Calling Functions

```go
import "math"

func main() {
    fmt.Println(math.Pi)      // 3.141592653589793
    fmt.Println(math.Sqrt(4)) // 2
}
```

### Package Aliases

Rename imports to avoid conflicts or for brevity:

```go
import (
    f "fmt"
    s "strings"
)

func main() {
    f.Println(s.ToUpper("hello"))  // HELLO
}
```

### Dot Import (Avoid!)

Imports everything into the current namespace:

```go
import . "fmt"

func main() {
    Println("No need for fmt.")  // Don't do this!
}
```

> **Warning:** Dot imports make code harder to understand. Avoid them.

### Underscore Import

Import a package only for its side effects (init functions):

```go
import _ "image/png"  // Registers PNG decoder
```

This is useful for registering codecs.

## Creating Your Own Package

### Directory Structure

```
myproject/
├── go.mod
├── main.go
└── greeting/
    └── greeting.go
```

### greeting/greeting.go

```go
package greeting

import "fmt"

// Hello returns a greeting message
func Hello(name string) string {
    return fmt.Sprintf("Hello, %s!", name)
}
```

### main.go

```go
package main

import (
    "fmt"
    "myproject/greeting"
)

func main() {
    msg := greeting.Hello("Alice")
    fmt.Println(msg)  // Hello, Alice!
}
```

## init() Function

Packages can have an `init()` function that runs once at program start:

```go
package mypackage

import "fmt"

func init() {
    fmt.Println("mypackage initialized")
}
```

Multiple init functions run in the order they're defined in the file.

## Exported vs Unexported

Names starting with a capital letter are exported (public):

```go
package greeting

func Hello(name string) string {  // Exported - can be imported
    return "Hello, " + name
}

func hello(name string) string {  // Unexported - private to package
    return "hello, " + name
}
```

## go.mod and Dependencies

### Initialize a module

```bash
go mod init github.com/username/project
```

### Add dependencies

```bash
go get github.com/some/package
```

### The go.mod file

```go
module github.com/username/project

go 1.21

require (
    github.com/some/package v1.2.3
)
```

## Best Practices

1. **Keep packages focused** - one package per directory
2. **Use meaningful names** - `greeting` not `greeter`
3. **Export only what's needed** - lowercase for internal
4. **Group imports** - standard lib, third-party, your packages

## Code Playground

Try importing packages and creating your own package structure!
