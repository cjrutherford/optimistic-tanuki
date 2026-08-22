# Import Statements

Imports bring external code into your file.

---

## Basic Import

```go
import "fmt"

func main() {
    fmt.Println("Hello!")
}
```

---

## Multiple Imports

```go
import (
    "fmt"
    "math"
    "strings"
)
```

---

## Package Aliases

Rename imports to avoid conflicts:

```go
import (
    f "fmt"
    str "strings"
)

func main() {
    f.Println(str.ToUpper("hello"))
}
```

---

## Dot Import (Avoid!)

```go
import (
    . "fmt"
)

func main() {
    Println("Hello!")  // No prefix
}
```

**Warning:** This is considered bad practice.

---

## Unused Imports

Go won't compile with unused imports:

```go
import "fmt"
import "math"  // ERROR: imported and not used

func main() {
    fmt.Println("Hello")
}
```

**Solutions:**

1. Use the import
2. Remove the import
3. Use `_` to import for side effects only

---

## Import for Side Effects

```go
import _ "image/png"
```

This registers the PNG decoder but doesn't use it directly.

---

## Standard Library Examples

```go
import (
    "fmt"      // formatted I/O
    "os"       // operating system
    "strings"  // string utilities
    "time"     // time/date
)
```

---

## Best Practices

1. Use parenthesized imports
2. Group stdlib, then external
3. Use aliases only when needed
4. Keep imports clean
