# Why "Recursion Is Just a Loop" Is False Here

You will hear this claim, usually phrased as a comfort: "don't worry about
recursion using more stack than a loop: a good compiler turns tail calls
into loops anyway." The claim is true in some languages, under a specific
and named guarantee. It is not true, as a language guarantee, in Go, C++, or
Rust, the three systems languages behind this course. Believing it there
will eventually produce a stack overflow on an input that "should" have been
fine.

This lesson exists to make the claim precise enough that you can stop
guessing.

---

## What a Tail Call Is

A call is in _tail position_ if it's the very last thing a function does:
its return value is returned immediately, with no further computation
wrapped around it.

```go
// tail call: the recursive call's result is returned as-is
func sumAcc(prices []int, acc int) int {
    if len(prices) == 0 {
        return acc
    }
    return sumAcc(prices[1:], acc+prices[0])
}

// NOT a tail call: there's an addition waiting after the call returns
func sum(prices []int) int {
    if len(prices) == 0 {
        return 0
    }
    return prices[0] + sum(prices[1:])
}
```

`sumAcc`, from the previous lesson, is written so that when the recursive
call happens, the current call has nothing left to do: it will just hand
back whatever `sumAcc(prices[1:], acc+prices[0])` returns, unchanged. `sum`
is not in tail position: after `sum(prices[1:])` returns, the current call
still has to add `prices[0]` to it before it can return. That pending
addition is exactly what has to sit on the stack, waiting.

---

## What "Tail-Call Elimination" Would Buy

If a language guarantees tail-call elimination (sometimes "tail-call
optimization"), it means: a call in tail position is compiled to reuse the
current function's stack frame instead of pushing a new one, turning the
recursive call into, mechanically, a jump back to the top of the function
with new argument values. Done that way, `sumAcc` would run in constant
stack space no matter how long `prices` is, exactly like the `for` loop from
two lessons ago. That's the origin of "recursion is just a loop": under
elimination, a tail-recursive function _compiles to_ a loop.

The claim is doing real work only when it's backed by a guarantee. A
guarantee means: this transformation is part of the language's specified
behavior, so code can be written to depend on it, the way you'd depend on
integer overflow wrapping or not wrapping.

---

## The Guarantee, Checked Against the Languages Here

**Go, C++, and Rust do not guarantee tail-call elimination as part of the
language.** None of the three specifications require a compiler to turn a
tail call into a reused stack frame. A specific compiler, on a specific
version, with specific optimization settings, may perform this
transformation opportunistically for some tail calls. It's a legal
optimization, and real compilers sometimes do it, but "a specific compiler
sometimes does it" is a fact about that build, not a fact about the
language, and it can change with a compiler upgrade, a debug build, or a
function that turns out to be slightly more complex than the compiler's
heuristics handle. Code that only works correctly _because_ elimination
happened to fire is code relying on an implementation detail, not a
language feature, and it will keep working right up until it doesn't, on
some input just large enough to matter.

That distinction ("not guaranteed by the language" versus "never
happens") is the one to hold onto. It is not true that these three
languages _never_ eliminate a tail call. It is true that none of them
_promise_ to, which means you cannot write recursive code depending on it
and call that code correct.

**This course will not make a claim about any other language's guarantee
one way or the other**, that's the kind of detail worth checking in a
language's own specification or a course built specifically around it,
rather than assuming from general reputation.

---

## What This Means Practically

Without a guarantee, the stack-growth cost from the previous lesson is real
for `sumAcc` in Go, C++, and Rust, exactly as real as it is for `sum`, even
though `sumAcc` is written in the shape that _would_ be free under
elimination. A long enough `prices` slice can overflow the stack calling
`sumAcc` just as it can calling `sum`: the tail-position shape reduces
nothing about the guarantee, only about what a hypothetical eliminating
compiler _could_ do with it.

The practical response, in these languages, is not "write tail-recursive
code and trust it": it's one of:

- Use the loop from the first lesson in this module when the recursion
  depth could be large or is driven by external input size. The stack cost
  a loop doesn't have is not a detail of compiler behavior; it's a fact
  about what a loop compiles to.
- Keep recursion for cases where the depth is naturally small and bounded
  (walking a balanced tree of known modest depth, for instance), where stack
  growth was never going to be the risk.
- If a language you use elsewhere does guarantee elimination, that's a
  property of _that_ language, checked against _its_ specification, not a
  property you can import into Go, C++, or Rust by writing code that looks
  the same shape.

---

## Reading the Claim Correctly Going Forward

"Recursion is just a loop" is a true sentence with an invisible clause:
_in a language that guarantees tail-call elimination_. Drop the clause and
carry the sentence into Go, C++, or Rust, and it becomes a claim about a
specific compiler's mood on a specific day, not a claim about the language.

1. A tail call is a recursive call that is the very last action in a
   function, with nothing pending after it returns.
2. Tail-call elimination, where guaranteed, compiles a tail call into
   reused-frame, constant-stack-space execution: genuinely equivalent to a
   loop.
3. Go, C++, and Rust do not guarantee this as part of the language; a
   compiler may do it opportunistically, but code cannot rely on it.
4. Without the guarantee, a tail-recursive function still grows the stack
   one frame per call in these languages, exactly like any other recursive
   function, regardless of its shape.
