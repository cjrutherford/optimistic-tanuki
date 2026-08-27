# A Timeout Tells You Nothing

Here is the headline claim of this module, stated once, plainly, so nothing later can hide from it: a timeout is the caller giving up. It is not a report that the work failed. The work may have succeeded. It may still be running. It may succeed a moment after you stopped waiting for it. A timeout tells you exactly one thing, which is that you decided not to wait any longer, and it tells you nothing at all about what happened on the other end.

Most code does not act like it believes this. Most code catches a timeout and treats it as a failure, because a failure is easier to write a branch for than "unknown." This lesson is about the gap between those two things, and about an incident in this workspace where the gap was the entire bug.

---

## The Incident

`apps/gateway/src/controllers/learning/learning.controller.ts` has a route, `POST activities/:activityId/answer`, that grades a learner's written response against a rubric using a language model. Grading prose against a rubric is not fast. The gateway's default request timeout is 30 seconds, sized for ordinary request/response work, and marking blew straight through it.

Here is what actually happened, and it matters that you read it slowly: the gateway gave up at 30 seconds and answered the learner with a timeout error. The marking work kept running on the other side of that boundary, because nothing told it to stop. It finished. It produced a real, correct grade. And the learner never saw it, because as far as the client was concerned, the request had already failed.

A learner submitted a written answer, was told it broke, and had in fact been graded correctly a few moments later on a course that is mostly written answers. That is not a rare edge case for this feature; that is the feature working exactly as fast as it was going to work, on a request whose failure was manufactured entirely by the gateway giving up too early and calling its own impatience an error.

---

## Naming the Three Real Outcomes

A timeout collapses three genuinely different outcomes into one signal:

1. **The work failed.** The model errored, the database rejected the write, the downstream service crashed. This is the only case a timeout is sometimes standing in for correctly.
2. **The work is still running.** It will finish, eventually, with some answer, good or bad. The caller has no way to know this from the timeout alone.
3. **The work already succeeded.** It finished and tried to tell you, and either its answer arrived after you stopped listening, or the connection carrying it back was already gone.

A timeout looks identical from the caller's seat in all three cases. That is the whole problem. Code that writes `catch (TimeoutError) { markAsFailed() }` is choosing outcome one and betting the other two never happen. On the marking route in this workspace, outcome three happened, in front of learners, on a route that was live.

```typescript
try {
  const result = await gradeAnswer(submission);
  return result;
} catch (err) {
  // This branch cannot tell a real failure from "I gave up at 30s and the
  // grading finished at 34s." Both arrive here identically.
  return { status: 'failed' };
}
```

---

## What Actually Fixed It

The fix in this workspace was not to make the gateway more patient everywhere. It was `@ModelBound()`, a per-route override documented in `apps/gateway/src/decorators/request-timeout.decorator.ts`, applied to that one route so its budget matched how long marking actually takes rather than how long an ordinary request takes. The comment on `answerActivity` in the learning controller records the incident directly: "the gateway's 30 second default is not enough: a written answer graded against a rubric answered a 408 here while the marking itself completed fine a moment later."

Notice what this fix does and does not claim. It does not claim the gateway can now tell the three outcomes apart. It cannot; nothing about a longer deadline gives you that. What it does is make outcome three far less likely to occur in the first place, by sizing the wait to match the work instead of guessing short and living with the consequence. Distinguishing the three outcomes for good needs something the timeout alone will never give you: an idempotent way to ask "did this actually happen," covered in a later lesson in this module. A longer, correctly sized deadline is the cheap fix that prevents most of the pain; the expensive fix, asking after the fact, is the only one that resolves it completely.

---

## The Discipline This Demands

Once you accept that a timeout means "I stopped waiting" and nothing more, a few things stop being optional:

- Never write a `catch` block for a timeout that assumes the underlying work failed. Write one that assumes you don't know, and design the rest of the system so not knowing is survivable.
- Never build a retry on top of a timeout without asking what happens if the first attempt actually succeeded after you gave up on it. The next lesson in this module is entirely about that question.
- Treat "the user saw an error" and "the work failed" as two separate facts that a timeout conflates by default and that your code has to pull back apart on purpose.

1. A timeout is the caller giving up, not a verdict on the work.
2. The work behind a timed-out call may have failed, may still be running, or may have already succeeded.
3. A gateway default sized for ordinary requests will time out real work that just happens to be slower, and the user cannot tell that apart from the feature being broken.
4. Fix the budget first; fix the ability to ask "did this happen" second, because only the second one closes the gap for good.
