# Who Is Responsible for Freeing It

A heap value doesn't free itself. Something has to decide the moment has
come and act on it. Ownership is the name for the answer to a narrower
question that sits underneath that: for any given heap value, which single
place in the program is responsible for making that call? Every language
has an answer, even the languages that never use the word.

---

## Why "One Place" Matters

If two places both think they're responsible for freeing the same value,
you get a double free. If no place thinks it's responsible, you get a leak.
Both bugs come from the same root cause: responsibility that isn't clearly
assigned to exactly one place.

```cpp
int* p = new int(42);
delete p;
delete p;   // undefined behavior — two places both tried to free it
```

```cpp
void leak() {
    int* p = new int(42);
    // nobody frees p — no place was actually responsible
}
```

Ownership, as a discipline, is the rule that exactly one place holds that
responsibility at any moment, and that responsibility can move but never
duplicate.

---

## Left to the Programmer

In C++ without smart pointers, "who owns this" is a convention you keep in
your head and in your documentation, not something the compiler tracks.

```cpp
int* p = new int(42);
// ...a hundred lines later, in a function that received p somehow...
delete p;   // is this the one place responsible? the compiler has no idea
```

`std::unique_ptr` turns that convention into an object: exactly one
`unique_ptr` may point at a resource at a time, enforced by making it
non-copyable. Ownership transfers with `std::move`, and the moved-from
pointer becomes null, which is the compiler's way of confirming there is
still only one owner after the transfer.

```cpp
auto p1 = std::make_unique<int>(42);
auto p2 = std::move(p1);   // ownership transfers; p1 is now null
```

`letsgocpp/modules/memory/02-smart-pointers.md` covers `unique_ptr`,
`shared_ptr`, and `weak_ptr`: the last two exist for the case where "one
owner" is genuinely the wrong model, and you want either shared ownership
with a reference count or a non-owning observer. `letsgocpp/modules/memory/03-raii.md`
is the other half: tying that one responsible place to an object's
constructor and destructor is what makes the responsibility actually get
discharged, even when an exception is unwinding the stack past it.

Nothing here is compiler-enforced the way the next section describes. A
`unique_ptr` stops you from _copying_ the owning pointer, but you can still
get a raw pointer out of it with `.get()` and use that raw pointer after the
`unique_ptr` is gone. C++ gives you tools to encode single ownership; it
does not force you to use them everywhere.

---

## Left to a Collector

A garbage-collected language sidesteps the "one place responsible for
freeing" question almost entirely. Nothing frees a value explicitly; instead
the collector periodically asks "is anything still reachable from a root,"
and reclaims whatever the answer is no for.

This is worth being precise about, because it's easy to overstate: garbage
collection changes _who_ decides when a value is freed. It does not mean
ownership stops existing as a concept, and it does not mean allocating is
free. `letsgogo/modules/gc/01-how-gc-works.md` describes the tri-color
mark-sweep algorithm doing exactly the reachability check described above,
running concurrently with your program, work that still costs CPU time,
even though no line of your code calls `free`.

```go
func newUser() *User {
    user := User{Name: "Alice"}
    return &user   // escapes to the heap; the GC now owns freeing it
}
```

Nobody in a Go program writes "who owns `user`." The collector will free it
once nothing reachable points to it anymore, however many places hold a
pointer to it in the meantime. Multiple owners are fine, because the
scheme was never "exactly one place is responsible" — it was "reclaim
whatever's unreachable," which needs no single responsible place at all.

---

## Enforced by the Compiler

Rust keeps the "exactly one place is responsible" rule from the C++ section,
and makes the compiler check it on every line rather than trusting the
programmer to use `unique_ptr` consistently.

```rust
let s1 = String::from("hello");
let s2 = s1;          // ownership moves from s1 to s2

println!("{}", s1);   // compile error: s1 no longer owns anything
```

`letsgorust/modules/ownership/01-ownership-rules.md` states the rule
directly: each value has a single owner, and when that owner goes out of
scope, the value is dropped — no collector, no manual `delete`, and no way
to accidentally keep two owners around, because the compiler invalidates the
old one the moment ownership moves. This is the same operation C++'s
`std::move` performs on a `unique_ptr`, with one difference: Rust checks
every assignment this way by default, not only the ones you opted into with
a smart-pointer type.

---

## The Same Question, Three Enforcement Levels

1. **Convention only**: C++ raw pointers. The programmer decides who owns
   what, documents it, and the compiler trusts them.
2. **Encoded, opt-in**: C++ smart pointers. The type system enforces single
   ownership for the pointers that use it, but nothing stops you from
   reaching around it with a raw pointer.
3. **Enforced everywhere, or replaced by reachability** — Rust makes single
   ownership the default and checks it at compile time; a garbage collector
   replaces the question with "is this reachable" and needs no single owner
   at all.

When you land in an unfamiliar language, ask which of these three it's
doing before you assume its memory model resembles the last language you
learned. "Who is responsible for freeing this, and what stops two places
from both thinking they are" is the question; C++, Go, and Rust are three
different, defensible answers to it.

---

## Best Practices

1. Before trusting a pointer, ask who is responsible for freeing what it
   points to, and whether that's enforced or just documented
2. In C++, default to `unique_ptr`; reach for `shared_ptr` only when
   ownership is genuinely shared
3. Remember a garbage collector answers a different question (reachability),
   not "who owns this," and that its work still costs time
4. Read a Rust "value moved here" error as a single-ownership rule being
   enforced, not an arbitrary restriction
