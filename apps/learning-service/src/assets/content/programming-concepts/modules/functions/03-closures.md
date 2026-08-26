# What a Closure Actually Captures

Of everything in this module, this is the lesson worth slowing down for. Get
the mental model here wrong and you will ship the same bug in every language
you ever touch, because the bug isn't a language quirk: it's a
misunderstanding of what a closure is.

The wrong model: a closure takes a snapshot of a variable's value at the
moment it's created. The right model: **a closure captures the variable
itself** (the storage location), and reads whatever is in that location
when it eventually runs, which may be long after and far from where the
closure was written.

---

## A Closure, Defined

A closure is a function paired with the environment it was created in: the
variables from its enclosing scope that its body refers to. The Go course
introduces this in `letsgogo/modules/basics/03-functions.md` with `adder`,
returning a function that keeps updating a `sum` variable no one outside the
closure can see directly:

```go
func adder() func(int) int {
    sum := 0
    return func(x int) int {
        sum += x
        return sum
    }
}
```

Every call to `pos(1)`, `pos(2)`, `pos(3)` sees a `sum` that remembers the
last call. That's only possible because the returned function didn't get a
copy of `sum` when it was created. It holds a reference to the _same_ `sum`
that persists across calls. The closure captured the variable, not a value.

---

## Where the Snapshot Model Breaks

The failure mode shows up whenever a closure is created inside a loop and
used after the loop, typically because several closures are created that
each seem like they should remember "their" iteration's value.

```go
var funcs []func()
for i := 0; i < 3; i++ {
    funcs = append(funcs, func() {
        fmt.Println(i)
    })
}
for _, f := range funcs {
    f()
}
```

If a closure captured a snapshot, this would print `0`, `1`, `2`. Since a
closure captures the _variable_, every closure in `funcs` shares the same
`i`, and what gets printed depends on what `i` holds by the time each
closure actually runs, not on what it held when the closure was created.

**A necessary correction about Go specifically.** Prior to Go 1.22, `i` in a
`for` loop was one variable, reused across all iterations, so the example
above printed `3, 3, 3` in that version of the language: every closure saw
the final value. As of Go 1.22, the language changed the loop semantics so
that each iteration gets its own copy of the loop variable, and the code
above now prints `0, 1, 2` as most people expect. That is a real, deliberate
change to the language, not a trick, but it does not change the underlying
rule that closures capture variables, not values. It changed _how many
variables the loop creates_, which is a different thing. Do not read "Go
fixed this" as "closures stopped capturing variables." They still do; Go
just started giving each iteration a fresh variable to capture.

---

## The Rule Still Bites Everywhere Else

Outside of a `for`-loop variable in current Go, the same capture-by-variable
rule produces the same class of bug in every language here. Nothing any of
them did changed what capture means. What changed, in Go's loop and in
TypeScript's `let`, is how many variables the loop creates for closures to
capture.

**TypeScript**, with `var`:

```ts
var funcs = [];
for (var i = 0; i < 3; i++) {
  funcs.push(() => console.log(i));
}
funcs.forEach((f) => f()); // 3, 3, 3 — var is function-scoped, one shared i
```

`let` fixes this the same way Go 1.22 fixes its loop: by giving each
iteration its own binding. But that fix is specific to `let`'s scoping
rules, not to closures capturing values instead of variables:

```ts
let funcs = [];
for (let i = 0; i < 3; i++) {
  funcs.push(() => console.log(i));
}
funcs.forEach((f) => f()); // 0, 1, 2 — let creates a fresh i per iteration
```

**Rust**, capturing a shared counter rather than a loop variable:

```rust
let mut handles = vec![];
let counter = std::sync::Arc::new(std::sync::Mutex::new(0));
for _ in 0..3 {
    let counter = std::sync::Arc::clone(&counter);
    handles.push(std::thread::spawn(move || {
        *counter.lock().unwrap() += 1;
    }));
}
```

Rust's borrow checker forces this one into the open: without the `let
counter = Arc::clone(&counter)` shadow inside the loop, the closure would try
to capture the _same_ `counter` binding across every spawned thread, and the
compiler rejects a `move` closure that would need to own a variable more
than once. Rust cannot stop you from capturing a shared variable; that's
the whole point of a closure, but it does force you to be explicit about
whether each closure gets its own handle to shared state or a genuinely
independent one.

**C++**, where the capture mode is spelled out at the call site rather than
inferred, as covered in
`letsgocpp/modules/modern-cpp/01-auto-lambdas.md`:

```cpp
int factor = 3;
auto byValue = [factor]() { return factor; };  // copies factor now
auto byRef   = [&factor]() { return factor; }; // reads factor later

factor = 100;
byValue(); // 3   -- captured a copy at creation
byRef();   // 100 -- captured the variable, sees the update
```

C++ is the one language in these courses that makes the two models both
available and lets you pick per-variable: `[factor]` genuinely takes a
snapshot, `[&factor]` genuinely captures the variable. Every other closure
in every other language in this course behaves like `[&factor]`: it captures
the variable, whether or not the syntax says so.

---

## Sharing via Closure, Concurrently

Capturing a variable instead of a value has a second consequence once
multiple goroutines, threads, or async tasks can run the closure at
overlapping times: the shared variable becomes shared _mutable state_, with
everything that implies. The Go course's parallelism material names this
directly as "Sharing via Closure" in
`letsgogo/modules/parallelism/03-race-conditions.md`, showing goroutines
launched in a loop all observing a loop variable racing ahead of them. The
fix shown there, passing the value in as a parameter, `func(i int) { ... }
(i)`, works by no longer relying on capture at all: it hands the closure
its own copy through an ordinary function argument, which is evaluated
immediately, at the call site, before the loop moves on.

That's the general escape hatch, in every language: if you want a snapshot,
stop using capture to get the value into the closure. Pass it as a
parameter, or `let`/shadow a fresh local binding each iteration, or clone it
explicitly. Capture only gives you the variable; a snapshot is something you
build on top of that, deliberately, when you need one.

---

## Checklist for Reading Any Closure

1. What variables does the closure's body refer to that it didn't declare
   itself? Those are the captures.
2. For each one: is it captured as the live variable, or was it copied into
   a parameter or fresh local before the closure was built?
3. Will this closure run more than once, or later than it was created? If
   so, what will the captured variable hold _at that time_, not at creation
   time?
4. If the closure escapes to another goroutine, thread, or async task, is
   the captured variable otherwise shared, and does that sharing need a
   mutex, a channel, or an owned copy to be safe?
