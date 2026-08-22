# Functions in Rust

Functions are the building blocks of Rust programs.

## Defining Functions

```rust
fn greet(name: &str) {
    println!("Hello, {}!", name);
}

fn add(a: i32, b: i32) -> i32 {
    a + b  // Last expression without semicolon = return value
}
```

All parameters **must** have explicit type annotations. Return types are specified with `->`.

## Return Values

In Rust, the last expression in a function body is implicitly returned (no semicolon):

```rust
fn square(x: i32) -> i32 {
    x * x  // implicit return
}

fn square_explicit(x: i32) -> i32 {
    return x * x;  // explicit return (same result)
}
```

Use explicit `return` for early returns:

```rust
fn abs(x: i32) -> i32 {
    if x < 0 {
        return -x;  // early return
    }
    x  // implicit return
}
```

## Multiple Return Values (Tuples)

Rust functions can return multiple values using tuples:

```rust
fn min_max(v: &[i32]) -> (i32, i32) {
    let min = v.iter().min().copied().unwrap_or(0);
    let max = v.iter().max().copied().unwrap_or(0);
    (min, max)
}

fn main() {
    let (min, max) = min_max(&[3, 1, 4, 1, 5, 9]);
    println!("min={}, max={}", min, max);
}
```

## Closures

Closures are anonymous functions that can capture their environment:

```rust
let double = |x| x * 2;
let add_n = |x, n| x + n;

println!("{}", double(5));    // 10
println!("{}", add_n(3, 4));  // 7
```

## Higher-Order Functions

Functions can take other functions or closures as arguments:

```rust
fn apply<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 {
    f(x)
}

let result = apply(|x| x * x, 5);  // 25
```

> **Challenge**: Implement a function that adds two numbers together.
