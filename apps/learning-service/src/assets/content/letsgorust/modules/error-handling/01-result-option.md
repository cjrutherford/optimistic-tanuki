# Result and Option in Rust

Rust handles errors and absence of values with `Result<T, E>` and `Option<T>`.

## Option<T>

`Option` represents a value that may or may not exist:

```rust
fn find_item(items: &[&str], target: &str) -> Option<usize> {
    for (i, item) in items.iter().enumerate() {
        if *item == target {
            return Some(i);
        }
    }
    None
}

let items = ["apple", "banana", "cherry"];
match find_item(&items, "banana") {
    Some(index) => println!("Found at index {}", index),
    None => println!("Not found"),
}
```

### Useful Option Methods

```rust
let x: Option<i32> = Some(5);

x.unwrap()           // 5 (panics if None)
x.unwrap_or(0)       // 5 (returns 0 if None)
x.unwrap_or_else(|| compute_default())
x.is_some()          // true
x.is_none()          // false
x.map(|v| v * 2)     // Some(10)
x.filter(|&v| v > 3) // Some(5)
x.and_then(|v| if v > 0 { Some(v) } else { None })
```

## Result<T, E>

`Result` represents an operation that might fail:

```rust
use std::num::ParseIntError;

fn parse_number(s: &str) -> Result<i32, ParseIntError> {
    s.trim().parse::<i32>()
}

match parse_number("42") {
    Ok(n) => println!("Parsed: {}", n),
    Err(e) => println!("Error: {}", e),
}
```

### Useful Result Methods

```rust
let r: Result<i32, &str> = Ok(5);

r.unwrap()               // 5 (panics if Err)
r.unwrap_or(0)           // 5
r.is_ok()                // true
r.is_err()               // false
r.map(|v| v * 2)         // Ok(10)
r.map_err(|e| format!("Error: {}", e))
```

## The ? Operator

The `?` operator is syntactic sugar for propagating errors:

```rust
use std::fs;
use std::io;

fn read_file(path: &str) -> Result<String, io::Error> {
    let content = fs::read_to_string(path)?;  // return early if error
    Ok(content.to_uppercase())
}
```

Is equivalent to:

```rust
fn read_file(path: &str) -> Result<String, io::Error> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(e) => return Err(e),
    };
    Ok(content.to_uppercase())
}
```

> **Challenge**: Implement a safe division function using Result.
