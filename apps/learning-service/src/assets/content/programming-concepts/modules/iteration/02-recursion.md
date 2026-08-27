# Carrying State in the Call Instead

The last lesson pointed at two mutable variables in every accumulating loop:
a counter and an accumulator, both reassigned every iteration, both living
outside the logic they support. Recursion is what happens when you refuse to
let either one be a mutable variable, and put both into function arguments
instead.

---

## The Same Sum, Recursively

```go
func sum(prices []int) int {
    if len(prices) == 0 {
        return 0
    }
    return prices[0] + sum(prices[1:])
}
```

No `sum` variable, no `i`. The "current running total" doesn't exist as a
mutable slot anywhere: it exists as the return value of a call that hasn't
finished yet, and the "how far along am I" state is just how much of
`prices` a given call was handed. Each call is a fixed, unchanging snapshot
of the state at that point in the computation, because arguments in a single
call don't get reassigned out from under you the way a loop variable does.

Compare that to the version with an explicit accumulator passed along:

```go
func sumAcc(prices []int, acc int) int {
    if len(prices) == 0 {
        return acc
    }
    return sumAcc(prices[1:], acc+prices[0])
}

sum := sumAcc(prices, 0)
```

This is the more direct translation of the loop from the previous lesson.
`acc` plays the exact role `sum` played there (a running total), except it
is a new, immutable binding on every call rather than one mutable variable
reassigned in place. "Carrying state in the call" means literally this:
instead of mutating a variable and looping back, you pass the updated value
forward as an argument and call again.

The same reshaping happens in any of these languages, not just Go:

```rust
fn sum_acc(prices: &[i32], acc: i32) -> i32 {
    match prices {
        [] => acc,
        [first, rest @ ..] => sum_acc(rest, acc + first),
    }
}
```

```ts
function sumAcc(prices: number[], acc: number): number {
  if (prices.length === 0) return acc;
  const [first, ...rest] = prices;
  return sumAcc(rest, acc + first);
}
```

Three languages, one shape: a base case that returns the accumulator
unchanged, and a recursive case that computes the next accumulator value
once and passes it forward. Nothing here is Go-specific; it's a way of
writing "loop with state" that any of these languages can express.

---

## What This Buys You

**Each call's state is a value, not a snapshot of a mutation in progress.**
At the moment `sumAcc(prices[1:], acc+prices[0])` is evaluated, `acc+prices[0]`
is computed once and handed off: there's no window where some other part of
the program could observe `acc` between "half updated" and "fully updated,"
because there is no single `acc` being updated at all. Every call has its
own.

**The base case and the recursive case are visibly separate.** `if
len(prices) == 0 { return acc }` is the whole stopping condition, in one
place, instead of being encoded in a loop header's comparison
(`i < len(prices)`) that has to be gotten exactly right to avoid an
off-by-one. Recursion doesn't make off-by-one mistakes impossible, and a wrong
base case is exactly as capable of causing one, but it does put the
question "when do I stop" in a single, prominent `if`, separate from the
question "what do I do with the rest."

**It composes with the earlier lessons in this course.** A recursive
function like `sum` above is pure in exactly the sense the functions module
was after: given the same slice, it returns the same number, every time,
with no hidden mutation anywhere in its body. That's not a coincidence:
removing the mutable accumulator was most of what made it pure.

---

## What It Costs

Every recursive call is a real function call, and a real function call
usually means a real stack frame: space set aside to remember where to
return to and what the local variables were, so the call underneath it can
run and eventually hand a value back. A loop that runs a thousand iterations
uses the same, fixed amount of stack space for all thousand. A recursive
function called a thousand levels deep, in the ordinary case, uses stack
space that grows with the depth: a thousand frames stacked on top of each
other, each waiting for the one below to return before it can finish its own
`prices[0] + sum(...)`.

That's the cost the next lesson is entirely about. There is one specific
shape of recursive function (the `sumAcc` shape above, where the recursive
call is the very last thing the function does, with nothing left to compute
afterward) that some languages can optimize to use constant stack space,
exactly like a loop. Whether the languages behind this course actually make
that guarantee is not a detail to guess at, which is why it gets its own
lesson rather than a paragraph here.

---

## Recursion Is Not Automatically the Right Choice

Nothing here is an argument that recursive code is better than a loop in
general: often the loop from the previous lesson is more direct, easier for
a reviewer to see the cost of, and (until the next lesson's caveat is
accounted for) safer against deep-input stack growth. Recursion is worth
reaching for specifically when the _problem_ is naturally defined in terms
of smaller versions of itself: walking a tree, parsing nested structure,
divide-and-conquer algorithms, where expressing "solve the rest, then
combine" is clearer than any loop that tries to flatten the same idea into a
single running variable.

1. Recursion replaces a loop's mutable counter and accumulator with values
   passed as arguments to each call.
2. Each call's arguments are a fixed snapshot, immune to the "mutated out
   from under you mid-iteration" class of bug a loop variable is exposed to.
3. The base case and recursive case being visibly separate is a readability
   win, not a correctness guarantee: a wrong base case is still a bug.
4. Ordinary recursive calls cost a stack frame per call; whether that cost
   can be eliminated is language- and shape-specific, and is the whole
   subject of the next lesson.
