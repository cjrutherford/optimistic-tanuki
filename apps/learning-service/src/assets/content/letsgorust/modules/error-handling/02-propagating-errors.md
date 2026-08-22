# Propagating Errors in Rust

The `?` operator makes error propagation clean and ergonomic.

## The ? Operator

Use `?` after a `Result` or `Option` expression to propagate errors:

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_username_from_file() -> Result<String, io::Error> {
    let mut f = File::open("hello.txt")?;   // returns early if error
    let mut s = String::new();
    f.read_to_string(&mut s)?;              // returns early if error
    Ok(s)
}
```

## Chaining ? Operators

You can chain multiple `?` calls:

```rust
fn read_username_from_file() -> Result<String, io::Error> {
    let mut s = String::new();
    File::open("hello.txt")?.read_to_string(&mut s)?;
    Ok(s)
}

// Even more concise:
fn read_username_from_file() -> Result<String, io::Error> {
    std::fs::read_to_string("hello.txt")
}
```

## Converting Error Types

The `?` operator automatically converts errors using `From`:

```rust
use std::num::ParseIntError;
use std::io;

#[derive(Debug)]
enum AppError {
    Io(io::Error),
    Parse(ParseIntError),
}

impl From<io::Error> for AppError {
    fn from(e: io::Error) -> AppError {
        AppError::Io(e)
    }
}

impl From<ParseIntError> for AppError {
    fn from(e: ParseIntError) -> AppError {
        AppError::Parse(e)
    }
}

fn read_and_parse(path: &str) -> Result<i32, AppError> {
    let content = std::fs::read_to_string(path)?;  // auto-converts io::Error
    let n: i32 = content.trim().parse()?;           // auto-converts ParseIntError
    Ok(n)
}
```

## Using Box<dyn Error>

For quick prototyping, use `Box<dyn std::error::Error>`:

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let s = std::fs::read_to_string("file.txt")?;
    let n: i32 = s.trim().parse()?;
    println!("Number: {}", n);
    Ok(())
}
```

## Using thiserror and anyhow

Popular crates for error handling:

```rust
// thiserror: define custom error types easily
use thiserror::Error;

#[derive(Error, Debug)]
enum MyError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(#[from] std::num::ParseIntError),
}

// anyhow: for applications (not libraries)
use anyhow::{Result, Context};

fn run() -> Result<()> {
    let content = std::fs::read_to_string("file.txt")
        .context("Failed to read file")?;
    Ok(())
}
```
