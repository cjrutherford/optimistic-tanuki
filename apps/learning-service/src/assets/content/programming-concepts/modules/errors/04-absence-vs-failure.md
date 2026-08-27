# Nothing Found Is Not the Same as Broken

"Not found" and "broke while looking" are different facts, and a lot of
code collapses them into the same signal because the language handed it a
single value (`null`, most often) that has to mean both. The moment you
reuse one value for two different meanings, the caller loses the ability to
tell them apart, and that loss is where a specific, recurring bug lives.

---

## What Gets Lost

A search that finds nothing has succeeded: it did its job, correctly, and
the job's honest answer is "there is no such thing." A search that fails
(the database connection dropped, the index is corrupted) has not done its
job at all; the true answer is unknown, not "nothing."

```typescript
function findUser(id: number): User | null {
  // returns null if not found... but also if the lookup itself failed?
}

const user = findUser(42);
if (user === null) {
  // is this "no user with id 42," or "the lookup broke"?
  // findUser's signature cannot tell you, and neither can this line
}
```

Whatever code called `findUser` now has to guess. If it assumes "not
found" and shows "no such user" to a person, but the real cause was a
database timeout, that's a wrong message shown with full confidence. If it
assumes every `null` might be a failure and wraps every call in extra
defensive checking, it's paying a cost for a distinction the function
signature refused to make. Either way, the caller is doing work (guessing,
or defending against every possibility) that the function itself could
have settled by returning something more specific.

---

## Where the Two Cases Actually Diverge

The reason this distinction matters in practice, not just in principle, is
that the two cases call for different responses:

1. **Absence** is often the correct, final answer. "No user with that ID"
   is not a problem to retry or alert on: it's information, and the right
   response is usually to act on it directly (show an empty state, offer to
   create one).
2. **Failure** is usually not final. "The database timed out" might be
   worth retrying, logging, or surfacing as a system problem: none of
   which make sense to do in response to a legitimate absence.

A caller that can't tell these apart ends up either retrying "not found"
forever (which will never succeed, because there's nothing to find) or
silently swallowing real failures as if they were ordinary absences (which
hides a problem worth knowing about).

---

## Rust Makes It a Type-Level Distinction

Rust's standard library gives absence and failure two separate types
instead of overloading one value to mean both.

```rust
fn find_item(items: &[&str], target: &str) -> Option<usize> {
    for (i, item) in items.iter().enumerate() {
        if *item == target {
            return Some(i);
        }
    }
    None   // absence: the search worked, there's just no match
}
```

`Option<T>` is exclusively for "a value, or nothing": the search-succeeded,
nothing-matched case. A function returning `Option<usize>` cannot use `None`
to mean "the search broke," because `Option` doesn't carry a reason. If a
function's failure needs a reason attached, Rust reaches for a different
type entirely:

```rust
fn parse_number(s: &str) -> Result<i32, ParseIntError> {
    s.trim().parse::<i32>()
}
```

`Result<T, E>` is for "a value, or a reason it's missing": the failure
case, where `Err` carries information about _what went wrong_, not just
that something did. `letsgorust/modules/error-handling/01-result-option.md`
covers both types and their common methods (`unwrap_or`, `map`,
`and_then` on `Option`; `map_err` on `Result`) side by side, which is worth
reading with this distinction already in mind: the methods look similar
because both types are "maybe there's a value," but only one of them is
also carrying a reason.

The signature itself now tells the caller which situation they're in.
`Option<usize>` promises the search cannot fail in a way that needs
explaining: worst case is "not found." `Result<i32, ParseIntError>`
promises the opposite: if this doesn't produce a value, here is why, typed
and inspectable, not a string you have to parse back apart.

```rust
match find_item(&items, "banana") {
    Some(index) => println!("Found at index {}", index),
    None => println!("Not found"),   // a normal, final outcome
}

match parse_number(input) {
    Ok(n) => println!("Parsed: {}", n),
    Err(e) => println!("Error: {}", e),   // e explains what went wrong
}
```

---

## The Same Split Without Rust's Types

You don't need Rust's type system to make this distinction: you need to
decide to make it. A Go function can return a `bool` alongside a value to
signal "found or not," reserving `error` for genuine failure, which is
exactly the shape of the two-value map lookup: `value, ok := m["key"]`.
`ok` being `false` means the key genuinely isn't there (a clean, final
absence) which is a different signal than a function returning
`(nil, err)`. The distinction Rust enforces with two separate types, Go
achieves by convention with two different return shapes for two different
situations; the discipline required is the same even though the mechanism
differs.

What doesn't work, in any language, is reusing a single nullable return for
both meanings and trusting callers to infer which one occurred from
context. That inference is exactly the guess the opening example forced on
its caller, and it's avoidable the moment the function's design admits
absence and failure are two different outcomes worth two different signals.

---

## Best Practices

1. Before returning `null` (or its equivalent) from a fallible function,
   ask whether it means "nothing here" or "this broke", and whether both
   are possible from the same call
2. Prefer a type or a return shape that keeps those two outcomes separate,
   even without Rust's `Option`/`Result` split, a second boolean or a
   distinct error return will do
3. Read a nullable return in someone else's code with suspicion: check
   whether every path that can produce it is genuinely "not found," or
   whether a failure got funneled into the same value
4. Treat "not found" as a valid final answer and "failed to determine" as
   an open question, and keep your handling of each one separate
