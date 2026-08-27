# Integration Tests in Rust

Integration tests test your library's public API from the outside.

## Structure

Integration tests live in the `tests/` directory:

```
my_crate/
├── src/
│   └── lib.rs
└── tests/
    └── integration_test.rs
```

```rust
// tests/integration_test.rs
use my_crate;  // import the public API

#[test]
fn test_add_two() {
    assert_eq!(my_crate::add(2, 2), 4);
}
```

## Common Test Helpers

Avoid duplication with a shared `tests/common/mod.rs`:

```rust
// tests/common/mod.rs
pub fn setup() {
    // setup code
}

// tests/integration_test.rs
mod common;

#[test]
fn test_with_setup() {
    common::setup();
    // ... test code
}
```

## Test Organization

```bash
# Run all tests
cargo test

# Run only unit tests
cargo test --lib

# Run only integration tests
cargo test --test integration_test

# Run tests matching a name pattern
cargo test test_add

# Show stdout from passing tests
cargo test -- --nocapture

# Run tests single-threaded
cargo test -- --test-threads=1
```

## Mocking and Test Doubles

Rust doesn't have a built-in mock framework, but there are patterns:

```rust
// Dependency injection with traits
trait DataStore {
    fn get(&self, id: &str) -> Option<String>;
    fn set(&mut self, id: &str, value: String);
}

struct InMemoryStore {
    data: std::collections::HashMap<String, String>,
}

impl DataStore for InMemoryStore {
    fn get(&self, id: &str) -> Option<String> {
        self.data.get(id).cloned()
    }
    fn set(&mut self, id: &str, value: String) {
        self.data.insert(id.to_string(), value);
    }
}

fn process<S: DataStore>(store: &S, id: &str) -> Option<String> {
    store.get(id).map(|v| v.to_uppercase())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_process() {
        let mut store = InMemoryStore {
            data: std::collections::HashMap::new()
        };
        store.set("key1", String::from("hello"));
        assert_eq!(process(&store, "key1"), Some(String::from("HELLO")));
        assert_eq!(process(&store, "missing"), None);
    }
}
```
