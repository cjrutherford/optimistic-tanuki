# Custom Error Types

Well-structured Rust applications define their own error types.

## Implementing the Error Trait

```rust
use std::fmt;

#[derive(Debug)]
enum AppError {
    NotFound(String),
    InvalidInput(String),
    IoError(std::io::Error),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        match self {
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::InvalidInput(msg) => write!(f, "Invalid input: {}", msg),
            AppError::IoError(e) => write!(f, "IO error: {}", e),
        }
    }
}

impl std::error::Error for AppError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            AppError::IoError(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> AppError {
        AppError::IoError(e)
    }
}
```

## Using Custom Errors

```rust
fn find_user(id: u32) -> Result<String, AppError> {
    if id == 0 {
        return Err(AppError::InvalidInput("ID must be positive".to_string()));
    }
    if id > 100 {
        return Err(AppError::NotFound(format!("User {} not found", id)));
    }
    Ok(format!("User_{}", id))
}

fn main() {
    match find_user(0) {
        Ok(user) => println!("Found: {}", user),
        Err(e) => println!("Error: {}", e),
    }
}
```

## Using thiserror Crate

The `thiserror` crate reduces boilerplate significantly:

```rust
use thiserror::Error;

#[derive(Error, Debug)]
enum AppError {
    #[error("Not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("IO error")]
    Io(#[from] std::io::Error),
}
```

## Error Context with anyhow

For application code (not library code), `anyhow` provides easy context:

```rust
use anyhow::{Result, Context, bail, ensure};

fn parse_age(s: &str) -> Result<u8> {
    let age: u8 = s.parse()
        .with_context(|| format!("'{}' is not a valid age", s))?;

    ensure!(age <= 150, "Age {} is unrealistically large", age);

    Ok(age)
}

fn main() -> Result<()> {
    let age = parse_age("25")?;
    println!("Age: {}", age);
    Ok(())
}
```
