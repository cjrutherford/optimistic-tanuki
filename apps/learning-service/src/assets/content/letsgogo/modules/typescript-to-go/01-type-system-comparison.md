# Type System Comparison

Coming from TypeScript, you'll find Go's type system both familiar and surprising. Let's explore the key differences that matter most for your day-to-day work.

## The Big Picture

### TypeScript: Gradual Typing with Flexibility

```typescript
// TypeScript allows optional typing and union types
interface User {
  id: number;
  name: string;
  email?: string; // Optional property
}

// Union types - a variable can be one of multiple types
type Result = string | number;
type Nullable<T> = T | null | undefined;

// Structural typing - based on shape
interface Point {
  x: number;
  y: number;
}
function distance(p: Point) {
  return Math.sqrt(p.x * p.x + p.y * p.y);
}

distance({ x: 1, y: 2, z: 3 }); // Works! Has x and y, even with extra z
```

### Go: Static Typing with Simplicity

```go
// Go requires explicit types, no optional fields
type User struct {
    ID    int
    Name  string
    Email string  // No "optional" - use empty string or pointer
}

// No union types - use interfaces or pointers
type Result interface{}  // empty interface accepts anything

// Nominal typing - based on name, not shape
type Point struct { X, Y float64 }
func distance(p Point) float64 { return math.Sqrt(p.X*p.X + p.Y*p.Y) }

type Point3D struct { X, Y, Z float64 }
distance(Point3D{X: 1, Y: 2, Z: 3})  // ERROR! Point3D is NOT Point
```

## Key Differences

### 1. Type Declaration

**TypeScript: Type Inference Everywhere**

```typescript
// TypeScript infers types automatically
let x = 10; // x is inferred as number
let y = 'hello'; // y is inferred as string
let nums = [1, 2, 3]; // nums is number[]

// Type annotations are optional
function add(a: number, b: number): number {
  return a + b;
}
```

**Go: Explicit by Default**

```go
// Go requires explicit types in declarations
var x int = 10        // Full declaration
var y = 10            // Type inferred from value (int)

// Short declaration - most common
z := 10               // z is int
name := "hello"       // name is string

// Function signatures always explicit
func add(a int, b int) int {
    return a + b
}
```

**The Rule**: Use `:=` for short declarations inside functions. Use `var` for package-level variables or when you need explicit types.

### 2. No Optional Properties

**TypeScript: Optional Properties with `?`**

```typescript
interface Config {
  host: string;
  port?: number; // Optional - can be undefined
  timeout?: number; // Optional - can be undefined
}

const config: Config = {
  host: 'localhost',
  // port and timeout are optional!
};

// Must check before using optional properties
if (config.port) {
  console.log(config.port);
}
```

**Go: Zero Values and Pointers**

```go
type Config struct {
    Host    string
    Port    int     // Always has a value (zero value is 0)
    Timeout int     // Always has a value (zero value is 0)
}

// Or use pointers for true optionality
type ConfigOptional struct {
    Host    string
    Port    *int    // Pointer - can be nil
    Timeout *int    // Pointer - can be nil
}

// Usage
config := Config{Host: "localhost"}
// Port is 0 (zero value for int), not "undefined"

// Check if pointer is nil
if config.Port != nil {
    fmt.Println(*config.Port)  // Dereference with *
}
```

### 3. Union Types vs Interfaces

**TypeScript: Union Types**

```typescript
// A value can be one of several types
type Status = 'pending' | 'active' | 'completed';
type ID = string | number;

function processId(id: ID) {
  if (typeof id === 'string') {
    // id is string here
  } else {
    // id is number here
  }
}
```

**Go: Interfaces and Type Assertions**

```go
// Go uses interfaces for polymorphism
type ID interface{}  // Accepts any type (like any in TS)

// Better: define specific interface
type Stringer interface {
    String() string
}

// Type switch - Go's version of union type checking
func processId(id interface{}) {
    switch v := id.(type) {
    case string:
        // v is string here
        fmt.Println("String:", v)
    case int:
        // v is int here
        fmt.Println("Int:", v)
    default:
        fmt.Println("Unknown type")
    }
}
```

### 4. Generics (Go 1.18+)

**TypeScript: Generics Everywhere**

```typescript
// Generic functions
function identity<T>(arg: T): T {
  return arg;
}

// Generic interfaces
interface Container<T> {
  value: T;
  getValue(): T;
}

// Usage
const num = identity<number>(42);
const str = identity<string>('hello');
```

**Go: Simpler Generics**

```go
// Generic function
func Identity[T any](arg T) T {
    return arg
}

// Generic struct
type Container[T any] struct {
    Value T
}

func (c Container[T]) GetValue() T {
    return c.Value
}

// Usage - type inferred!
num := Identity(42)       // T is inferred as int
str := Identity("hello")  // T is inferred as string
```

### 5. Structural vs Nominal Typing

**TypeScript: Structural (Duck Typing)**

```typescript
interface Printer {
  print(): void;
}

class LaserPrinter {
  print() {
    console.log('Laser printing...');
  }
}

class InkjetPrinter {
  print() {
    console.log('Inkjet printing...');
  }
}

function usePrinter(p: Printer) {
  p.print();
}

// Both work because they have a print() method
usePrinter(new LaserPrinter());
usePrinter(new InkjetPrinter());
// Can even use plain objects!
usePrinter({ print: () => console.log('Mock printer') });
```

**Go: Nominal (Must Explicitly Implement)**

```go
type Printer interface {
    Print()
}

type LaserPrinter struct{}

func (lp LaserPrinter) Print() {
    fmt.Println("Laser printing...")
}

type InkjetPrinter struct{}

func (ip InkjetPrinter) Print() {
    fmt.Println("Inkjet printing...")
}

func UsePrinter(p Printer) {
    p.Print()
}

// These work because they implement Print()
UsePrinter(LaserPrinter{})
UsePrinter(InkjetPrinter{})

// Cannot use arbitrary structs - must implement interface
```

## Practical Translation Guide

| TypeScript Pattern                | Go Equivalent                         |
| --------------------------------- | ------------------------------------- |
| `const x: number = 5`             | `x := 5` or `var x int = 5`           |
| `let x: string`                   | `var x string` (zero value is "")     |
| `x?: string`                      | `x *string` (pointer)                 |
| `type Status = 'a' \| 'b'`        | `const StatusA, StatusB = iota, iota` |
| `interface User { name: string }` | `type User struct { Name string }`    |
| `Array<T>` or `T[]`               | `[]T` (slice)                         |
| `Map<K, V>`                       | `map[K]V`                             |
| `Promise<T>`                      | `chan T` or goroutines                |
| `function(x: T): U`               | `func(x T) U`                         |

## Common Gotchas

### Gotcha #1: Assignment vs Declaration

```typescript
// TypeScript
let x = 5;
x = 10; // Assignment - works!
```

```go
// Go
x := 5
x := 10  // ERROR! := is for declaration only
x = 10   // CORRECT! = is for assignment
```

### Gotcha #2: Type Aliases are New Types

```typescript
// TypeScript - type aliases are just aliases
type ID = number;
let x: ID = 5; // x is just a number
```

```go
// Go - type definitions create NEW types
type ID int
var x ID = 5    // x is type ID, not int!
var y int = x   // ERROR! Cannot assign ID to int
var z int = int(x)  // CORRECT! Must explicitly convert
```

### Gotcha #3: Nil vs Undefined

```typescript
// TypeScript
let x: string | undefined;
console.log(x); // undefined
```

```go
// Go
var x string
fmt.Println(x)  // "" (empty string - the zero value)

var p *string
fmt.Println(p)  // <nil>
```

## Best Practices

1. **Use `:=` for short variable declarations** inside functions
2. **Use `var` for package-level variables** or when you need to declare without initializing
3. **Use pointers for optional values** instead of "zero values" when you need to distinguish "unset" from "empty"
4. **Embrace zero values** - they're safe to use immediately
5. **Explicit is better than implicit** - Go values clarity over brevity

## Code Playground

Try translating some TypeScript code to Go!
