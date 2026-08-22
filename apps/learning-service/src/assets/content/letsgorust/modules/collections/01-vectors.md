# Vectors in Rust

Vectors (`Vec<T>`) are Rust's growable, heap-allocated arrays.

## Creating Vectors

```rust
// Empty vector with type annotation
let v: Vec<i32> = Vec::new();

// Using vec! macro
let v = vec![1, 2, 3, 4, 5];

// With capacity hint
let mut v = Vec::with_capacity(10);
```

## Adding and Removing Elements

```rust
let mut v = Vec::new();
v.push(5);
v.push(6);
v.push(7);

let last = v.pop();  // Some(7)
```

## Accessing Elements

```rust
let v = vec![1, 2, 3, 4, 5];

// Index access (panics if out of bounds)
let third = v[2];

// get() returns Option<&T>
match v.get(2) {
    Some(third) => println!("Third: {}", third),
    None => println!("No third element"),
}
```

## Iterating

```rust
let v = vec![100, 200, 300];

// Immutable references
for x in &v {
    println!("{}", x);
}

// Mutable references
let mut v = vec![1, 2, 3];
for x in &mut v {
    *x += 10;  // dereference to modify
}

// Consuming iteration
for x in v {
    println!("{}", x);
}
// v is no longer valid here
```

## Common Vector Operations

```rust
let mut v = vec![3, 1, 4, 1, 5, 9, 2, 6];

v.sort();
v.dedup();          // remove consecutive duplicates
v.reverse();
v.retain(|&x| x > 3);  // keep only elements > 3
v.len()
v.is_empty()
v.contains(&5)
v.iter().sum::<i32>()
v.iter().min()
v.iter().max()
```

## Slices

Vectors coerce to slices `&[T]`:

```rust
fn sum(slice: &[i32]) -> i32 {
    slice.iter().sum()
}

let v = vec![1, 2, 3];
println!("{}", sum(&v));  // works!
println!("{}", sum(&[4, 5, 6]));  // also works!
```

> **Challenge**: Implement a function to sum all elements in a vector.
