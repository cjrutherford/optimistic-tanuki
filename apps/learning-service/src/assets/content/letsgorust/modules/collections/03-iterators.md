# Iterators in Rust

Iterators in Rust are lazy, composable, and zero-cost abstractions.

## The Iterator Trait

Anything implementing `Iterator` can be iterated:

```rust
trait Iterator {
    type Item;
    fn next(&mut self) -> Option<Self::Item>;
}
```

## Creating Iterators

```rust
let v = vec![1, 2, 3];

v.iter()       // yields &T (immutable references)
v.iter_mut()   // yields &mut T (mutable references)
v.into_iter()  // yields T (consumes the vector)

// Ranges
(1..=10).into_iter()  // 1, 2, ..., 10
```

## Iterator Adapters (Lazy)

Adapters transform iterators — they're evaluated lazily:

```rust
let v = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// map: transform each element
let doubled: Vec<i32> = v.iter().map(|&x| x * 2).collect();

// filter: keep matching elements
let evens: Vec<&i32> = v.iter().filter(|&&x| x % 2 == 0).collect();

// chain multiple adapters
let result: Vec<i32> = v.iter()
    .filter(|&&x| x % 2 == 0)
    .map(|&x| x * x)
    .collect();  // [4, 16, 36, 64, 100]
```

## Consuming Adapters

These consume the iterator and produce a final value:

```rust
let v = vec![1, 2, 3, 4, 5];

v.iter().sum::<i32>()           // 15
v.iter().product::<i32>()       // 120
v.iter().count()                // 5
v.iter().max()                  // Some(5)
v.iter().min()                  // Some(1)
v.iter().any(|&x| x > 3)        // true
v.iter().all(|&x| x > 0)        // true
v.iter().position(|&x| x == 3)  // Some(2)
v.iter().find(|&&x| x > 3)      // Some(4)
```

## flatten and flat_map

```rust
let nested = vec![vec![1, 2], vec![3, 4], vec![5]];
let flat: Vec<_> = nested.iter().flatten().collect();  // [1, 2, 3, 4, 5]

let words = vec!["hello world", "foo bar"];
let chars: Vec<_> = words.iter().flat_map(|s| s.split(' ')).collect();
// ["hello", "world", "foo", "bar"]
```

## take and skip

```rust
let v: Vec<i32> = (1..=10).take(3).collect();  // [1, 2, 3]
let v: Vec<i32> = (1..=10).skip(7).collect();  // [8, 9, 10]
```

## zip and enumerate

```rust
let names = vec!["Alice", "Bob"];
let scores = vec![10, 20];
let paired: Vec<_> = names.iter().zip(scores.iter()).collect();
// [("Alice", 10), ("Bob", 20)]

for (i, name) in names.iter().enumerate() {
    println!("{}: {}", i, name);
}
```

## Creating Your Own Iterator

```rust
struct Counter {
    count: u32,
}

impl Counter {
    fn new() -> Counter { Counter { count: 0 } }
}

impl Iterator for Counter {
    type Item = u32;
    fn next(&mut self) -> Option<u32> {
        if self.count < 5 {
            self.count += 1;
            Some(self.count)
        } else {
            None
        }
    }
}
```

> **Challenge**: Use iterators to filter and map a vector.
