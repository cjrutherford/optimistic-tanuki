# Threads in Rust

Rust's ownership system makes safe concurrency a core feature.

## Creating Threads

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 1..=5 {
            println!("Thread: {}", i);
            thread::sleep(Duration::from_millis(1));
        }
    });

    for i in 1..=5 {
        println!("Main: {}", i);
        thread::sleep(Duration::from_millis(1));
    }

    handle.join().unwrap();  // wait for thread to finish
}
```

## Moving Data into Threads

Use `move` to transfer ownership to the spawned thread:

```rust
let data = vec![1, 2, 3];

let handle = thread::spawn(move || {
    println!("{:?}", data);  // data is moved into the thread
});

handle.join().unwrap();
// data is no longer accessible here
```

## Scoped Threads

`thread::scope` allows borrowing data from the parent thread:

```rust
use std::thread;

let data = vec![1, 2, 3];

thread::scope(|s| {
    s.spawn(|| {
        println!("{:?}", data);  // borrows data — no move needed!
    });
});  // all scoped threads join here automatically
```

## Thread Safety: Send and Sync

Rust uses two marker traits to ensure thread safety:

- `Send`: A type can be transferred to another thread
- `Sync`: A type can be shared between threads (via references)

Most types are automatically `Send + Sync`. The exceptions differ in _which_
of the two they lack, and the difference decides what you can do with them:

- `Rc<T>` is neither `Send` nor `Sync`. Its reference count is updated without
  synchronisation, so it cannot cross threads at all. Use `Arc<T>`.
- `Cell<T>` and `RefCell<T>` **are** `Send` when `T: Send` — you may move one
  to another thread — but they are not `Sync`, so they cannot be _shared_ by
  reference across threads. To share, use `Mutex<T>` or `RwLock<T>`.
- Raw pointers are neither, because the compiler knows nothing about what they
  point to.

The short version: `Send` is about moving a value to another thread, `Sync` is
about two threads holding `&T` at once. A type can have the first without the
second, and `RefCell` is the everyday example.

## Panic Handling in Threads

Thread panics are caught by `join()`:

```rust
let handle = thread::spawn(|| {
    panic!("something went wrong!");
});

match handle.join() {
    Ok(_) => println!("Thread finished OK"),
    Err(_) => println!("Thread panicked!"),
}
```
