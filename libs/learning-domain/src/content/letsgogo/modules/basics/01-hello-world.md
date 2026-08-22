# Hello World

Welcome to Go! Let's start with the classic first program that every programmer writes when learning a new language.

## Your First Go Program

```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

### Expected Output

```
Hello, World!
```

---

## Deep Dive: Understanding Each Component

### 1. The Package Declaration (`package main`)

Every Go source file **must** begin with a package declaration. This is not optional—it's a fundamental part of Go's module system.

```go
package main
```

**Key Points:**

- **`package`** is a reserved keyword that declares the file's package
- **`main`** is a special package name that tells the Go compiler this is an executable program, not a library
- If you create a library, you'd use a different name like `package utils` or `package myapp`
- All files in the same directory must declare the **same** package

**Why is this important?**

Go enforces that executable programs must be in the `main` package. This design choice:

- Makes it immediately clear which code is executable
- Allows the Go toolchain to know how to build your code
- Follows Go's philosophy of explicity over implicit

### 2. Imports (`import "fmt"`)

Imports bring external code into your program. The `fmt` package is part of Go's standard library and provides functions for formatted I/O operations.

```go
import "fmt"
```

**Import Syntax Variations:**

**Single import:**

```go
import "fmt"
import "math"
```

**Parenthesized imports (recommended):**

```go
import (
    "fmt"
    "math"
    "os"
)
```

**Why parenthesized?**

- Cleaner and more readable
- Easier to add/remove imports
- Standard in Go projects

### 3. The Main Function (`func main()`)

The `main` function is where program execution begins. Think of it as the front door to your application.

```go
func main() {
    // Your code here
}
```

**Key Characteristics:**

- Must be in the `main` package
- Takes no arguments: `func main()`
- Returns nothing: no return type specified
- No semicolons needed (Go inserts them automatically)

### 4. Printing to Console (`fmt.Println`)

`fmt.Println` is your go-to function for displaying output:

```go
fmt.Println("Hello, World!")
fmt.Println("Line 1")
fmt.Println("Line 2")
```

**Output:**

```
Hello, World!
Line 1
Line 2
```

---

## Printf vs Println: When to Use Which?

### Println

- Automatically adds spaces between arguments
- Always adds a newline at the end
- Best for simple debugging and output

```go
name := "Alice"
age := 30
fmt.Println(name, age)  // Alice 30
```

### Printf

- Formatted output using format specifiers
- Does NOT add newline (use `\n` manually)
- Best for formatted output

```go
name := "Alice"
age := 30
fmt.Printf("Name: %s, Age: %d\n", name, age)
// Name: Alice, Age: 30
```

### Common Format Specifiers

| Specifier | Type     | Example       |
| --------- | -------- | ------------- |
| `%s`      | string   | `"Hello"`     |
| `%d`      | int      | `42`          |
| `%f`      | float    | `3.14`        |
| `%t`      | boolean  | `true`        |
| `%v`      | any type | (auto-detect) |
| `%#v`     | any type | (Go syntax)   |

---

## Running Your Go Code

### Method 1: Run Directly

The quickest way to execute your program:

```bash
go run main.go
```

This compiles and runs in one step—perfect for development.

### Method 2: Build First

Compile to an executable, then run:

```bash
go build main.go    # Creates 'main' (or 'main.exe' on Windows)
./main              # Run the compiled executable
```

### Method 3: Build with Custom Name

```bash
go build -o myapp main.go
./myapp
```

---

## Common Errors and How to Fix Them

### Error 1: "undefined: fmt"

```
./main.go:4:2: undefined: fmt
```

**Fix:** You forgot to import `"fmt"` at the top of your file.

### Error 2: "main redeclared"

```
main redeclared in this package
```

**Fix:** You have multiple `main.go` files in the same directory. Only one file should have `package main`.

### Error 3: "package main declared but not used"

```
./main.go:3:1: imported and not used: "fmt"
```

**Fix:** If you import a package, you must use it. Remove unused imports.

---

## Key Takeaways

1. **Every executable** needs `package main`
2. **Imports** bring in external code; use the `fmt` package for printing
3. **func main()** is the entry point where execution begins
4. **Println** adds spaces and newlines; **Printf** gives you control over formatting
5. **Go doesn't use semicolons** (they're inserted automatically)

---

## Next Steps

Now that you've mastered the basics of printing, move on to:

- **Variables & Types** - Learn how to store and work with data
- **Functions** - Create reusable blocks of code
- **Challenge:** Try writing a program that prints your name and favorite color!

---

> **Pro Tip:** Run `go fmt yourfile.go` to automatically format your code according to Go's standards. This ensures consistent style across your codebase.
