# Test-Driven Development in Rust

TDD in Rust: write tests first, then implement code to make them pass.

## The TDD Cycle

1. **Red**: Write a failing test
2. **Green**: Write the minimum code to make it pass
3. **Refactor**: Improve code without breaking tests

## Example: Building a Stack

**Step 1: Write tests first**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_stack_is_empty() {
        let stack: Stack<i32> = Stack::new();
        assert!(stack.is_empty());
    }

    #[test]
    fn test_push_and_pop() {
        let mut stack = Stack::new();
        stack.push(1);
        stack.push(2);
        assert_eq!(stack.pop(), Some(2));
        assert_eq!(stack.pop(), Some(1));
        assert_eq!(stack.pop(), None);
    }

    #[test]
    fn test_peek() {
        let mut stack = Stack::new();
        stack.push(42);
        assert_eq!(stack.peek(), Some(&42));
        assert!(!stack.is_empty());  // peek doesn't remove
    }
}
```

**Step 2: Implement to make tests pass**

```rust
struct Stack<T> {
    data: Vec<T>,
}

impl<T> Stack<T> {
    fn new() -> Self {
        Stack { data: Vec::new() }
    }

    fn push(&mut self, item: T) {
        self.data.push(item);
    }

    fn pop(&mut self) -> Option<T> {
        self.data.pop()
    }

    fn peek(&self) -> Option<&T> {
        self.data.last()
    }

    fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}
```

## Property-Based Testing with proptest

For comprehensive testing, use the `proptest` crate:

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn sort_is_idempotent(v: Vec<i32>) {
        let mut v1 = v.clone();
        let mut v2 = v.clone();
        v1.sort();
        v2.sort();
        v2.sort();  // sort again
        assert_eq!(v1, v2);  // sorting twice == sorting once
    }

    #[test]
    fn sum_commutes(a: i32, b: i32) {
        assert_eq!(a + b, b + a);
    }
}
```

## Test Coverage

Track test coverage with `cargo-tarpaulin`:

```bash
cargo install cargo-tarpaulin
cargo tarpaulin --out Html
```

> **Challenge**: Implement the Fibonacci sequence using TDD.
