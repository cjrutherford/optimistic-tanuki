# A Green Suite Is Not a Working System

A test suite that passes tells you one thing precisely: every test that
ran, ran, and none of them failed. It does not tell you that the system
works. Those two statements feel close enough to swap for each other, and
most of the time the gap between them doesn't matter, because most of the
time the tests that ran are the tests that were supposed to run. This
module is about the shapes that gap takes when it does matter, and why
"the suite is green" is a claim about the suite, not a claim about the
system.

---

## The Claim a Green Suite Actually Makes

Unpack "all tests passed" and it decomposes into two separate claims that
are easy to conflate:

1. **Every test that ran, passed.**
2. **Every test that should have run, ran.**

A CI dashboard reports the first. It usually reports something like "74
passed, 0 failed" as if that number were self-evidently reassuring. But
"74 passed" is not the same claim as "the 89 tests this suite is supposed
to have all passed." If a file failed to compile and its tests were
silently excluded from the run, the runner doesn't say "15 tests could not
be evaluated." It says "0 failed," because zero of the tests that _did_
run, failed. The suite is green. The system it was supposed to be checking
is unverified in exactly the places those 15 tests covered.

That is not a hypothetical shape. It happened here: an edit to a spec file
left both an old and a new version of some tests in the same file, the
file failed to compile, and the runner reported 74 passed with no
failures. Nothing in that report says "compile error." Nothing says
"missing tests." The only signal anyone had was noticing that the total
had dropped from 89, a number nobody was watching for, on a dashboard that
was, by every visible measure, green.

---

## Why This Isn't "Tests Are Unreliable"

The right reaction to this is not to distrust tests generally; a passing
test that ran is real evidence about the thing it checked. The right
reaction is narrower: a test suite verifies exactly what it runs, and
"what it runs" is a fact about the suite's own health, not something the
pass/fail count reports on. Two different classes of problem live on
either side of that line:

```text
"does the code do what the test expects?"   ──▶ a failing test answers this
"did the test I'm relying on actually run?" ──▶ a green count does NOT answer this
```

A suite can be perfectly rigorous about the first question and silent
about the second. Compile errors that drop a file from the run,
`.skip`/`.only` left in from debugging, a CI config that quietly excludes
a directory: these are all failures of the second kind, and a green
dashboard looks identical whether the second kind of failure happened or
not.

---

## How a Compile Error Becomes a Green Run

It's worth being precise about the mechanism, because "a file failed to
compile and its tests didn't run" sounds like it should be loud, and in
this case it wasn't. The spec file in question had been edited to replace
some tests with new versions, and both the old and new versions ended up
in the file at once, in a way that didn't type-check. The test runner
encountered the file, couldn't compile it, and excluded it from the run
rather than halting the whole suite. That's a reasonable design choice for
a test runner in isolation: one broken file shouldn't take down every
other file's results.

But it means the runner's summary line is answering a narrower question
than it appears to. "74 passed, 0 failed" is the accurate answer to "of
the tests that were successfully collected, how many passed." It reads
like the answer to "is the system's test coverage intact," which is a
different question the runner was never actually answering.

```text
what the dashboard shows:  74 passed / 0 failed
what actually happened:    15 tests silently excluded, the other 74 ran fine
what the dashboard implies: "everything is covered and everything passed"
```

---

## What to Check Instead of the Color

Green or red is the wrong level of resolution for the question "is this
suite still telling me something." What answers it:

- **The count, tracked over time.** 89 dropping to 74 is a five-second
  check if the number is visible somewhere, and it is the only signal
  that caught the compile-error case above. A pass/fail count with no
  history is a snapshot with nothing to compare against.
- **Whether the specific test you're relying on ran at all**, not just
  whether the suite as a whole was green. This is the subject of
  `knowing/04-make-it-fail-first.md` later in this module: a test you have
  personally watched fail, for the reason you expect, is a stronger claim
  than a test that has only ever been observed passing.
- **Whether the suite exercises the real thing**, which is a different
  question again, covered next.

1. "Passed" describes the tests that ran; it says nothing about tests that
   didn't.
2. A dropping total is a symptom a color-only dashboard cannot show; watch
   the count, not just the outcome.
3. Green is necessary and is not sufficient. Treat it as "no evidence of a
   problem in what ran," not as "no problem."
