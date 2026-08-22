# HashMaps in Rust

`HashMap<K, V>` stores key-value pairs with O(1) average lookup.

## Creating HashMaps

```rust
use std::collections::HashMap;

let mut scores: HashMap<String, i32> = HashMap::new();

scores.insert(String::from("Alice"), 10);
scores.insert(String::from("Bob"), 20);

// From iterators
let teams = vec!["Blue", "Red"];
let initial_scores = vec![10, 20];
let scores: HashMap<_, _> = teams.iter().zip(initial_scores.iter()).collect();
```

## Accessing Values

```rust
let score = scores.get("Alice");  // Returns Option<&i32>

match score {
    Some(s) => println!("Score: {}", s),
    None => println!("No score"),
}

// Direct access (panics if missing)
let s = &scores["Alice"];
```

## Updating Values

```rust
// Overwrite
scores.insert(String::from("Alice"), 25);

// Insert only if key doesn't exist
scores.entry(String::from("Charlie")).or_insert(50);

// Update based on old value
let count = scores.entry(String::from("Alice")).or_insert(0);
*count += 1;
```

## Iterating

```rust
for (name, score) in &scores {
    println!("{}: {}", name, score);
}

// Keys and values separately
let keys: Vec<_> = scores.keys().collect();
let values: Vec<_> = scores.values().collect();
```

## Common Operations

```rust
scores.contains_key("Alice")   // true/false
scores.remove("Bob")           // Option<i32>
scores.len()
scores.is_empty()
```

## Word Count Example

```rust
use std::collections::HashMap;

fn word_count(text: &str) -> HashMap<&str, usize> {
    let mut map = HashMap::new();
    for word in text.split_whitespace() {
        let count = map.entry(word).or_insert(0);
        *count += 1;
    }
    map
}
```
