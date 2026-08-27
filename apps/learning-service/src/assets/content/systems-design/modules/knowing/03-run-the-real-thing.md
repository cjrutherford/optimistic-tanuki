# Run the Real Thing

Every lesson so far in this module has been building to one point: there
is a category of bug that no amount of well-written, well-covered,
entirely-green unit and integration testing will ever surface, because the
bug lives in the gap between what your tests simulate and what the running
system actually does. The only way to close that gap is to close it
directly: build the real artifact, start the real service, and call it.

---

## The Bug That Only a Running Service Could Find

The authorization module of this course covers an answer-key leak in
`getOfferingDetail`: a course-authoring endpoint that was supposed to
withhold answer keys from anyone but the offering's owner was instead
returning the full, un-projected offering to everyone, answer keys
included. It was fixed in commit `cf1562af`.

Here is the part that matters for this lesson: the full test suite was
green before that bug was fixed, and it was green after. Every test that
existed, passed, on both sides of the bug. The tests weren't wrong about
what they checked; they simply didn't check this. Nothing in the suite
called the endpoint and inspected which fields came back on the JSON body
for a non-owner.

What found it was someone building the service, running it, requesting a
course from it as a real client would, and looking at the actual keys in
the actual response. Not reading the controller and reasoning about what
it should return. Not a test asserting a projection function's output.
Fetching the offering from the process that would serve it in production,
and reading what came back.

---

## Why This Finds Things Testing Structurally Can't

A unit test asserts that a function, called directly, with inputs you
chose, produces an output you chose to check. Every one of those decisions
(which function, which inputs, which fields of the output) is made by
someone with a hypothesis about what might be wrong, and a test can only
catch a deviation from a hypothesis someone had. The answer-key leak
required no hypothesis at all to find, only looking at what was actually
in the response:

```text
unit test:        call the function, assert the fields you thought to check
integration test: call more of the stack, assert the fields you thought to check
running service:  call the actual endpoint, see every field that comes back,
                   whether or not you thought to ask about it
```

Running the real thing doesn't require deciding in advance what to check
for. It surfaces whatever is actually there, including the fields nobody
wrote an assertion for because nobody thought to be suspicious of them.
That is a fundamentally different kind of coverage than any number of
well-chosen assertions, and it's why "the tests are green" and "I ran it
and looked" are not substitutes for each other.

---

## Why "We'll Add a Test for It" Isn't the Whole Answer

After a bug like this is found, the reflexive fix is to write a test that
checks the specific field that leaked, and stop there. That test is worth
writing; it pins this exact regression. But it quietly narrows the lesson
down to "we forgot to assert on `answerKey`," when the real lesson is
broader: nobody had looked at the full shape of what the endpoint
returned, for any field, to any caller, outside of what the feature's own
tests happened to assert.

A new field added next year, on a different endpoint, with the same
withholding requirement, gets none of the benefit of this test unless
someone remembers to write an equivalent assertion for it too, by hand,
every time. Running the real service and reading the actual response
doesn't have that gap: it shows every field that came back, this time and
the next time, without anyone having to enumerate in advance which fields
matter. That's what makes it a different kind of check rather than a
faster way to write the same kind of test.

---

## What This Does and Doesn't Argue

This is not an argument that tests are inferior to manual verification, or
that a growing test suite is wasted effort. `knowing/02-test-the-seam.md`
showed a bug tests couldn't see because a double was wrong; this lesson
shows a different bug, one that would have needed a test written with the
specific suspicion "check every field of the response, not just the ones
the feature is about." Nobody had that suspicion until the running system
showed the field.

The two practices catch different things because they ask different
questions. A test asks "does this match what I expected." Running the real
thing asks nothing in particular; it just shows you what's actually
there. Both are necessary. Neither makes the other optional.

1. A test can only catch a deviation from something someone thought to
   assert; a running system shows you everything, asked for or not.
2. "The suite is green" and "I called the running service and looked" are
   answers to different questions, not the same claim said two ways.
3. Before trusting a fix that touches what data leaves a service, build
   it, run it, and read the actual response body.
