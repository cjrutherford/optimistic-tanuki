# A Test You Have Not Seen Fail

A test that has only ever been observed passing is making a claim you have
no direct evidence for. It says "if the bug were present, I would catch
it," but you've only ever run it against code where the bug isn't present.
That's a hypothesis, not a result. The only way to turn it into a result is
to put the bug back, run the test, and watch it fail for the reason you
expect. Anything short of that is trusting the test on its word.

---

## The Fix It Was Checked Against

The answer-key leak covered in the previous lesson, `getOfferingDetail`
returning full offerings including answer keys to non-owners, was fixed by
projecting the response so only the owner sees the full offering. The
natural next step is to write tests: one asserting a non-owner gets the
withheld fields removed, one asserting the owner still gets everything.

Writing those tests and watching them pass tells you the fix works when
the fix is present. It does not, by itself, tell you the tests would have
caught the bug if the fix had never been written. Those are different
claims, and the only way to check the second one is to remove the fix and
watch what happens.

---

## What Was Actually Verified

The fix was pulled back out, and the suite was run against the unfixed
code. Exactly two tests failed: the two withholding cases, the ones
asserting a non-owner does not receive the answer key. Every other test
still passed, including the owner-access test and the draft-visibility
test.

```text
fix removed, suite run:
  ✗ non-owner does not see answer key on published offering  (expected fail)
  ✗ non-owner does not see answer key on draft offering       (expected fail)
  ✓ owner sees full offering, including answer key            (still passes)
  ✓ draft visibility rules unchanged                           (still passes)
```

That's the whole check: not "did something fail," but "did _exactly the
expected somethings_ fail, and nothing else." A test suite where removing
a fix causes an unrelated pile of tests to fail too is telling you the
tests are entangled in ways you don't understand yet. A test suite where
removing the fix causes nothing to fail is telling you the tests never
covered the bug in the first place, no matter how confident they looked.

---

## Why It Had to Be Both Directions

The owner-access test staying green while the fix was removed is not
incidental to this check; it's half of it. The fix here wasn't "always
strip the answer key," it was "strip it for everyone except the owner."
A naive version of the fix, one that stripped answer keys from every
caller regardless of ownership, would have broken course authors: an
owner opening their own offering to edit it would have gotten back a copy
with no answer key, and saving that copy would have overwritten their real
mark scheme with nothing.

Pinning both directions, the case that should fail without the fix and the
case that should keep passing, is what rules that out. A test suite that
only checked "non-owners can't see the answer key" would have been
perfectly happy with the broken, over-broad fix. Removing the actual fix
and confirming the owner-access test _doesn't_ also fail is what confirms
the fix drew the line in the right place, not just some line.

---

## This Is Not the Same Claim as "The Test Is Correct"

Watching a test fail for the expected reason, then pass once the fix is
restored, rules out a specific and common way a test can be worthless: a
test that passes regardless of whether the code under test is right,
because of a mistake in the test itself (an assertion that's trivially
true, a mock that returns the expected value no matter what's passed to
it, a comparison against the wrong variable). None of those bugs announce
themselves when the test passes. They all announce themselves the moment
you try to make the test fail and it won't.

That's a narrower claim than "this test is a good test." A test can fail
correctly when the fix is removed and still be a poor test: too narrow,
too coupled to implementation detail, or checking something that doesn't
matter. Failing on cue is necessary evidence that the test is connected
to the thing it claims to check. It isn't sufficient evidence that the
test is checking the right thing, or checking it completely. It's the
first fact worth establishing, not the last one.

---

## The General Practice

"Make it fail first" doesn't only apply after the fact, to a fix already
merged. It's the same discipline as writing a test before the code that
satisfies it (red, then green): the test has to be seen failing at least
once, for the reason you expect, or its passing state carries no
information about whether it actually exercises the bug.

1. A test that has never been watched failing for the right reason is
   unverified as a test, whatever its current color says.
2. Remove the fix, run the suite, and check that exactly the tests you
   expect to fail, fail. No more, no fewer.
3. When a fix has two directions (withhold for some, allow for others),
   pin both, and confirm removing the fix breaks only the direction it
   was supposed to cover.
