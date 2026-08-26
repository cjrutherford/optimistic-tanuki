# Scope and Lifetime Are Different Questions

"Where can I write this name?" and "how long does the thing it points to
stick around?" sound like the same question. They aren't, and the gap
between them is where closures, dangling references, and a good chunk of
Go's garbage collector all live. Scope is a property of source code, decided
before the program runs. Lifetime is a property of a running value, decided
while the program executes. A name's scope can end while the value it
pointed to is still alive. That's the entire reason closures work, and
tracking that gap is what this lesson is for.

---

## Scope: Where a Name Is Visible

Scope is purely textual. Look at the source, without running anything, and
you can say exactly where a name can be used.

```javascript
function outer() {
  let x = 10;
  {
    let y = 20;
    console.log(x, y); // both visible here
  }
  console.log(y); // ReferenceError: y is not defined — out of scope
}
```

`y`'s scope is the inner block. Step outside it in the source and the name
`y` simply doesn't resolve: this is a compile-time or parse-time fact in
most languages, not something that depends on what the program does at
runtime.

---

## Lifetime: How Long a Value Exists

Lifetime is about the value, not the name, and it's a runtime fact: when did
this piece of memory become valid, and when does it stop being valid (freed,
collected, or otherwise unreachable).

For a lot of everyday code, scope and lifetime end at the same moment and
the distinction is invisible:

```cpp
void process() {
    int x = 10;   // x's scope starts, x's lifetime starts
}                 // x's scope ends, x's lifetime ends — same line, same moment
```

But they don't have to coincide, and the interesting bugs and features
happen exactly where they diverge.

---

## Where They Split: The Escaping Value

Go's compiler has to answer, for every local variable, whether it can live
on the stack (freed automatically the instant its scope ends) or whether
it needs to outlive its scope, in which case it goes on the heap instead.

```go
func newUser() *User {
    user := User{Name: "Alice"} // user's scope is this function
    return &user                // but a pointer to it leaves the function
}
```

`user`'s _scope_ is exactly the body of `newUser`: you cannot write the name
`user` anywhere outside this function. But its _lifetime_ has to extend
beyond that scope, because the returned pointer is still pointing at it
after the function returns. Go's compiler detects this and allocates `user`
on the heap instead of the stack specifically so the value survives longer
than its name's scope does: this is exactly what
`apps/learning-service/src/assets/content/letsgogo/modules/gc/02-escape-analysis.md`
means by a variable "escaping." Scope ended at the closing brace. Lifetime
kept going, because the garbage collector can see the pointer is still
reachable.

---

## Where Rust Makes the Gap a Compile Error

Rust asks the same question Go's escape analysis asks: does this value's
lifetime need to outlast its scope? But instead of solving it by moving
the value to the heap automatically, it requires the _code_ to prove the
lifetime is long enough, or refuses to compile.

```rust
fn dangle() -> &String {
    let s = String::from("hello");
    &s
}
```

`s`'s scope is the function body. Returning `&s` asks for a reference whose
lifetime extends past that scope, into the caller, but nothing backs that
reference once `s`'s scope ends and `s` is dropped. `apps/learning-service/src/assets/content/letsgorust/modules/ownership/03-lifetimes.md`
walks through the two distinct compiler errors this produces (a missing
lifetime specifier, then a "returns a reference to local data" error if you
paper over the first) and why they're different failures at different
stages. The concept underneath both is exactly this lesson's split: a
reference's lifetime is being asked to exceed the scope of the value it
refers to, and Rust, unlike Go, refuses to solve that by silently heap-
allocating. It makes you either shrink the requested lifetime or hand back
owned data instead.

---

## Where the Split Is the Whole Feature: Closures

A closure is a function that keeps a working reference to a variable from
an enclosing scope, after that enclosing scope has finished executing. It is
the clearest possible demonstration that scope and lifetime are different
axes, because a closure is _built_ out of the gap between them.

```javascript
function makeCounter() {
  let count = 0; // count's scope is makeCounter's body
  return function () {
    count += 1; // this inner function still reaches count
    return count;
  };
} // makeCounter's body finishes executing here — count's scope has ended

const counter = makeCounter();
counter(); // 1
counter(); // 2 — count is still alive, still being mutated
```

`count`'s scope, the region of source code where you can write the bare
name `count`, is exactly the body of `makeCounter`. That scope textually
ends at the closing brace. But `count`'s lifetime does not end there,
because the function returned from `makeCounter` captured a reference to it,
and that reference keeps `count` reachable for as long as `counter` itself
is reachable, which could be the rest of the program.

This is exactly the same shape as the Go pointer example above: a name's
scope ends, but something still points at the value, so its lifetime has to
extend past the scope that created it. A closure is what you get when a
language lets a function value carry that "something still points at it"
relationship out into the wider program on purpose.

---

## Why the Distinction Pays Off

Once scope and lifetime are two separate questions in your head, several
things stop looking like special cases and start looking like the same
mechanism recurring:

1. A garbage collector's whole job is extending a value's lifetime past its
   originating scope whenever something reachable still needs it: Go's
   escape analysis is that decision being made ahead of time, at compile
   time, instead of tracked at runtime.
2. A dangling pointer or dangling reference, in any language that allows one,
   is a lifetime that ended while a name that assumed it hadn't kept being
   used.
3. Rust's borrow checker, introduced in the previous lesson as an aliasing
   rule, is doing double duty: it also refuses to compile any reference whose
   requested lifetime outruns the scope of the value it points to.
4. A closure is a deliberate, useful version of "lifetime outlives scope,"
   made safe by the language keeping the captured value alive for exactly as
   long as the closure itself is reachable.
