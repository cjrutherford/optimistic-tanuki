# Interior Mutability

The borrowing rules say you may have many shared references or one mutable
reference, never both. The compiler enforces that by reading your code.

Sometimes you need to mutate through a shared reference anyway, and the code is
still correct. Interior mutability is the sanctioned way to do it: the rule
does not go away, it moves from compile time to runtime.

You have already met this without it being named. `RefCell` appeared in the
`Send` and `Sync` discussion, and `Mutex` is the same idea made thread-safe.

---

## Why It Has to Exist

`&self` means shared, and shared normally means read-only:

```rust
struct Counter {
    hits: u32,
}

impl Counter {
    fn record(&self) {
        self.hits += 1; // error[E0594]: cannot assign to `self.hits`,
                        // which is behind a `&` reference
    }
}
```

The obvious answer is `&mut self`, and often that is the right one. But some
designs cannot take it:

- A cache that fills on first read. The caller has `&self` and expects reading
  not to require exclusive access.
- A value shared by several owners through `Rc`, which only ever hands out
  shared references.
- A trait method whose signature is fixed as `&self` by someone else.

---

## `Cell<T>`: Move Values In and Out

The simplest tool. `Cell` never gives you a reference to what is inside; you
replace the whole value or take a copy out. Because no reference to the
interior ever exists, no rule can be broken, so this needs no runtime checks
and costs nothing.

```rust
use std::cell::Cell;

struct Counter {
    hits: Cell<u32>,
}

impl Counter {
    fn record(&self) {
        self.hits.set(self.hits.get() + 1); // note: &self
    }

    fn total(&self) -> u32 {
        self.hits.get()
    }
}

let counter = Counter { hits: Cell::new(0) };
counter.record();
counter.record();
println!("{}", counter.total()); // 2
```

`get` requires `T: Copy`. For anything else, use `replace`, `take` or `set`,
which move values rather than copying them.

Reach for `Cell` when the contents are small and `Copy`. It cannot panic.

---

## `RefCell<T>`: Borrow, Checked at Runtime

When you need an actual reference to the interior, `RefCell` gives you one and
tracks the borrows itself.

```rust
use std::cell::RefCell;

let names = RefCell::new(vec!["ada"]);

names.borrow_mut().push("grace");        // a mutable borrow
println!("{}", names.borrow().len());    // 2, a shared borrow
```

- `borrow()` returns a `Ref<T>`, and any number may exist at once.
- `borrow_mut()` returns a `RefMut<T>`, and only one may exist, with no shared
  borrows alongside it.

Those are the same rules the compiler applies. The difference is what happens
when you break them:

```rust
let cell = RefCell::new(5);

let first = cell.borrow_mut();
let second = cell.borrow_mut(); // panics: already mutably borrowed
```

```text
thread 'main' panicked at src/main.rs:5:20:
RefCell already borrowed
```

Borrowing shared while a mutable borrow is alive gives the mirror message,
`RefCell already mutably borrowed`.

A compile error becomes a panic. You have not escaped the rules; you have
chosen to be told later, in exchange for a design the compiler could not
verify. Use `try_borrow` and `try_borrow_mut` when a failure is something you
want to handle rather than crash on.

The borrow lasts as long as its guard, and that is where accidental panics
come from. Two cases catch people, and both are about a guard living longer
than it looks.

A guard bound with `let` lives to the end of the scope:

```rust
let first = cell.borrow();          // guard alive from here
if first.len() > 0 {
    cell.borrow_mut().push(1);      // panics: still borrowed
}
```

And a temporary in a `match` scrutinee lives for the whole `match`, including
its arms:

```rust
match cell.borrow().first() {
    Some(_) => {
        cell.borrow_mut().push(1);  // panics: the scrutinee borrow is alive
    }
    None => {}
}
```

The fix in both cases is to finish with the value before borrowing again:

```rust
let count = cell.borrow().len();    // temporary dropped at the semicolon
if count > 0 {
    cell.borrow_mut().push(1);      // fine
}
```

Or `drop(first)` explicitly when a `let` binding is what you want.

Worth knowing, because it is the opposite of what people expect: a temporary
in an `if` condition **is** dropped before the body runs, so this does not
panic.

```rust
if cell.borrow().len() > 0 {
    cell.borrow_mut().push(1);      // fine
}
```

The rule is about where the temporary's lifetime ends, and `if` conditions,
`match` scrutinees and `let` bindings each answer that differently. When in
doubt, take the value out into a variable first.

---

## `Rc<RefCell<T>>`: Shared and Mutable

`Rc` gives several owners a shared reference each, and `RefCell` makes that
shared reference enough to mutate through. Together they are the standard way
to write a graph or a shared list in single-threaded Rust:

```rust
use std::cell::RefCell;
use std::rc::Rc;

let shared = Rc::new(RefCell::new(vec![1, 2]));
let other = Rc::clone(&shared);

other.borrow_mut().push(3);

println!("{:?}", shared.borrow()); // [1, 2, 3]
```

Both handles see the change, because `Rc::clone` copies the pointer rather
than the data.

This combination is easy to overuse. If a plain `&mut` would have worked, use
that instead: it is checked at compile time and cannot panic.

---

## Across Threads

`Cell` and `RefCell` are `Send` but not `Sync`, so they can be moved to another
thread but not shared with one. Their bookkeeping is not synchronised, so two
threads borrowing at once would race on the borrow count itself.

The thread-safe equivalents are `Mutex<T>` and `RwLock<T>`, and they are
interior mutability too: `lock()` takes `&self` and gives you a `&mut T`.

| Single-threaded  | Across threads  | On rule violation |
| ---------------- | --------------- | ----------------- |
| `Cell<T>`        | `Atomic*` types | cannot happen     |
| `RefCell<T>`     | `Mutex<T>`      | panic / block     |
| `Rc<RefCell<T>>` | `Arc<Mutex<T>>` | panic / block     |

The compiler enforces the distinction. `Rc<RefCell<T>>` sent to a thread is a
compile error, not a race, which is the whole point of `Send` and `Sync`.

---

## Best Practices

1. Use ordinary `&mut` wherever it works, and reach for these only when it does not
2. `Cell` for small `Copy` values, because it cannot panic
3. `RefCell` when you need a real reference to the interior
4. Keep borrows short, and let each guard drop before taking the next
5. Use `try_borrow_mut` where a conflict is a case to handle rather than a bug
6. Across threads it is `Mutex` and `RwLock`, and the compiler will not let you confuse the two
