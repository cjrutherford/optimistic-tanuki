# Unit Tests in Rust

Rust has built-in testing support — no external framework needed!

## Writing Tests

Tests are functions annotated with `#[test]` inside a `#[cfg(test)]` module:

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]
mod tests {
    use super::*;  // import everything from parent module

    #[test]
    fn test_add() {
        assert_eq!(add(2, 3), 5);
    }

    #[test]
    fn test_add_negative() {
        assert_eq!(add(-1, 1), 0);
    }
}
```

Run tests with:

```bash
cargo test
# or for a specific test:
cargo test test_add
```

## Assertion Macros

| Macro                          | Purpose                   |
| ------------------------------ | ------------------------- |
| `assert!(expr)`                | Assert expression is true |
| `assert_eq!(a, b)`             | Assert `a == b`           |
| `assert_ne!(a, b)`             | Assert `a != b`           |
| `assert!(expr, "msg {}", val)` | With custom message       |
| `panic!("msg")`                | Fail unconditionally      |

```rust
#[test]
fn test_string_processing() {
    let s = String::from("hello");
    assert!(!s.is_empty(), "String should not be empty");
    assert_eq!(s.len(), 5, "Expected length 5, got {}", s.len());
    assert_ne!(s, "world");
}
```

## Testing for Panics

Use `#[should_panic]` to test that code panics:

```rust
fn divide(a: i32, b: i32) -> i32 {
    if b == 0 { panic!("division by zero") }
    a / b
}

#[test]
#[should_panic(expected = "division by zero")]
fn test_divide_by_zero() {
    divide(10, 0);
}
```

## Testing Result

Tests can return `Result<(), E>`:

```rust
#[test]
fn test_parse() -> Result<(), std::num::ParseIntError> {
    let n: i32 = "42".parse()?;
    assert_eq!(n, 42);
    Ok(())
}
```

## Ignoring Tests

```rust
#[test]
#[ignore]
fn expensive_test() {
    // This won't run with `cargo test`
    // Run it with: cargo test -- --include-ignored
}
```

> **Challenge**: Implement a temperature converter with built-in tests.
