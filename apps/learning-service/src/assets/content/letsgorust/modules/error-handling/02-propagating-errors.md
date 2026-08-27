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

`?` converts the error it propagates into the function's error type. That is
awkward when a function can fail in several unrelated ways: reading a file
gives you an `io::Error`, parsing gives you a `ParseIntError`, and no single
concrete type covers both.

`Box<dyn std::error::Error>` is the escape hatch. Read it right to left:

- `std::error::Error` is a trait, so it describes what a type can do rather
  than what it is. Anything that can report itself as an error implements it.
- `dyn` means the concrete type is decided at runtime instead of compile time.
  A `dyn Trait` is called a trait object, and it is how one value can hold any
  of several types that share a trait. Traits and trait objects have their own
  module next.
- `Box` puts it on the heap, which is required here: different error types have
  different sizes, so the compiler cannot reserve space for "whichever one it
  turns out to be" on the stack.

Together it means "some error, I am not saying which". Every standard error
type converts into it automatically, so `?` works across all of them:

```rust
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let s = std::fs::read_to_string("file.txt")?; // io::Error
    let n: i32 = s.trim().parse()?;               // ParseIntError
    println!("Number: {}", n);
    Ok(())
}
```

The cost is that the caller learns nothing about what went wrong beyond a
message, so they cannot handle one failure differently from another. That is
fine in `main` and in prototypes, and wrong in a library. The next lesson
builds an error type that keeps the distinction.

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
