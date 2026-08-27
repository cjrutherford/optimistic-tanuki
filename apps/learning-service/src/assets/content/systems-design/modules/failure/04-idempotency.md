# Doing It Twice on Purpose

The previous lesson ended on a question that a retry policy cannot answer for you: is this call safe to repeat? "Idempotent" is the word for a call where the answer is yes by design: applying it twice leaves the system in the same state as applying it once. Not "runs twice without erroring." Not "returns the same response twice." The state on the other side has to be indistinguishable from a single application, no matter how many times the call actually landed.

This lesson is about why that's the hard part of the whole failure module, harder than the timeout budget, harder than the backoff curve, because it isn't a setting you tune or a library you install. It's a property you have to design into the operation itself, one operation at a time.

---

## Idempotent Is Not the Same as Safe-Looking

Some operations look idempotent and aren't. Some look dangerous and are actually fine. The only way to know is to ask what the operation does to state, not what it looks like on the wire.

`PUT /users/42 { name: "Alex" }`, run three times, leaves the same name stored each time. Idempotent, and idempotent for a structural reason: it says what the state should be, not how to change it.

`POST /accounts/42/deposit { amount: 50 }`, run three times, adds 150 to the balance instead of 50. Same shape of request, same HTTP verb conventionally associated with "not idempotent," but the actual reason it's dangerous is that it says how to change the state ("add 50") rather than what the state should become. Retry this one blind and you've silently over-credited an account, or, in the more common direction in this workspace's shape of problem, over-charged a learner's usage against a rate limit, or double-recorded a grade.

`DELETE /users/42`, run three times, deletes a user once and then reports "not found" twice more. Whether that counts as idempotent depends entirely on what you decide "not found" means: if the caller treats "already deleted" and "delete succeeded" as the same outcome, it's idempotent in effect even though the second and third calls technically fail.

The HTTP verb is a hint, not a proof. The actual test is: pick any number of deliveries of this exact call, and ask whether the resulting state is the same as one delivery. If the answer depends on how many times it landed, it isn't idempotent, no matter what the verb suggests.

---

## Why "Just Add a Library" Doesn't Work

It's tempting to think idempotency is a solved problem: attach an idempotency key to the request, have the server remember which keys it's seen, return the cached response for a repeat. That pattern is real and it works, but notice what it actually requires: a place to store keys, a decision about how long to remember them, and correct behavior on the underlying operation for the very first delivery, because the key only helps you recognize a repeat. It does nothing for the operation itself if that operation was never designed to be safely re-applied in the first place.

The library can deduplicate requests. It cannot make "add 50 to the balance" into "set the balance to 150," because that's a decision about what the operation means, and no amount of request-level tooling changes the meaning of the operation underneath it. This is why idempotency is described as a design property: the fix lives in how you model the write, not in the transport layer that carries the write to the server.

---

## Where This Workspace Gets It for Free, and Where It Has To Work For It

`apps/gateway/src/controllers/learning/learning.controller.ts` has a comment on `optInAsAuthor` worth reading closely: "The only route that grants learning_course_designer. Idempotent: opting in twice hits the same role assignment and the permissions service treats a repeat assignment as a no-op rather than an error." That's the "state, not verb" pattern from above: opting in doesn't say "add one more course-designer grant," it says "this profile should have this role," and a role either is or isn't assigned. There is no meaningful difference between assigning it once and assigning it three times, so the operation is idempotent by what it means, not by any special-casing on the endpoint.

Contrast that with grading. `answerActivity` grades a submission and records a mark. Grading twice is not automatically harmless the way opting in twice is, because a mark is exactly the kind of "add" operation the deposit example above warns about: if grading naively appended a new attempt record every time the route was called, a client that retried after a timeout (the exact scenario from the previous two lessons) would leave a learner with two graded attempts for one submission, and whichever one the dashboard reads last decides the score. That risk is a large part of why `GRADING_THROTTLE` in the same controller caps grading calls per identity: not because grading is expensive to compute alone, though it is, but because an ungoverned retry path on a write like this compounds instead of cancels.

The rate limit narrows the blast radius. It does not, on its own, make a repeated grading call semantically safe; that has to be true of what the grading write actually does to an attempt's stored state, independent of how many times the route gets hit.

---

## Designing for It

There's no shortcut list that replaces reading each operation on its own terms, but the questions that separate the safe writes from the dangerous ones repeat:

- Does this operation describe a target state ("set to X") or an increment ("add X")? Targets are naturally idempotent; increments are not, and need something else.
- If it's a target-state write, is the target actually deterministic given the same input, or does it depend on when the write lands?
- If it's an increment, can you attach an identity to each attempt (an idempotency key, a natural key like "this submission for this activity") so a repeat is recognizable as the same attempt rather than a new one?
- What does "already applied" look like to the caller? A silent no-op, matching the original response, is usually the right answer; a hard error on the second attempt often isn't, because it turns a harmless repeat into a visible failure.

1. Idempotent means the state after N deliveries matches the state after one, not that the call merely avoids erroring on a repeat.
2. The HTTP verb is a hint about intent, not a guarantee; the real test is whether the operation is stated as a target or as a change.
3. A deduplication library catches repeats. It cannot fix an operation whose underlying meaning was never safe to repeat.
4. This workspace's role grant is idempotent because it's phrased as a target state; grading needs its own answer to the same question because it isn't.
