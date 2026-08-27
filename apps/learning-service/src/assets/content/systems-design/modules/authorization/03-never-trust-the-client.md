# Marks the Client Cannot Write

Anything the client tells you about its own achievement is a claim, not a
fact. That sentence sounds obvious written down. It is violated constantly,
and usually not by carelessness. It is violated because the client already
knows the answer, sending it is less work than recomputing it, and the
resulting endpoint looks perfectly reasonable in a code review.

This platform shipped exactly that endpoint. Twice.

---

## The Endpoints That Had to Go

Commit `3d1955e2`, "make the marks unforgeable", removed two routes from
`apps/gateway/src/controllers/learning/learning.controller.ts`:

- `POST /learning/attempts` accepted an attempt with a score in the body
  and stored it.
- `POST /learning/evaluations` accepted an evaluation with a grade in the
  body and stored it.

Neither checked that the caller was enrolled. Neither checked that the
activity being graded existed. Neither recomputed anything. A signed-in
learner with the browser console open could award themselves full marks on
a course they had never opened, for an exercise that was never written,
and the server would record it as fact.

Nothing about those routes was a bug in the sense of a mistake in the
code. They did precisely what they were written to do. The design was the
defect.

---

## Why This Shape Keeps Appearing

The client genuinely does know the answer. The learner ran the code, the
test passed in the browser, the multiple-choice option was checked. Sending
`{ score: 10 }` is one line. Sending the raw answer and having the server
work it out again means the server needs the mark scheme, needs the
grading logic, and needs to do the work a second time.

So the shape appears for a real reason: it is cheaper. It also transfers
the authority to decide from a place you control to a place you do not.

The rule that catches this is worth stating precisely, because the loose
version ("validate your input") does not catch it at all. Validation asks
whether the value is well formed. A score of `10` is a perfectly well
formed integer within range. The question is not whether the value is
valid. It is **whether the client had standing to assert it.**

---

## Two Quieter Versions of the Same Bug

The same commit fixed two more instances that are less obvious, and are
worth more than the headline ones because you are more likely to write
these yourself.

**Taking the whole record.** `PUT /learning/me/progress` accepted the
entire progress object from the request body. It was not presented as a
scoring endpoint. It was a progress endpoint, and progress records happen
to carry a score, so a client could name its own. The fix narrowed it to
accept only `lessonId` and `completed`, the two fields a client is
genuinely entitled to assert:

```ts
// Before: whatever the body says, stored.
async saveProgress(@Body() body: LessonProgress) { ... }

// After: the two fields the caller has standing to claim, and no others.
async saveProgress(@Body() body: { lessonId: string; completed: boolean }) { ... }
```

**Forwarding the whole patch.** `PUT /learning/offerings/:id` passed the
request body through to the update. A co-editor is allowed to edit a
course. A co-editor is not allowed to publish one. But `status` is a field
on an offering, so a co-editor could include `status: 'published'` in an
edit and publish it themselves. The permission check was correct; it just
guarded a door that had a second door next to it. The fix replaced the
pass-through with a field-by-field patch.

Both of these have the same shape as the headline bugs, disguised. The
client is asserting something it is not entitled to assert, and the reason
it can is that the endpoint accepted a whole object where it should have
accepted named fields.

---

## What Replaced Them

Marks are now written only by server-side paths that grade the work
themselves: the answer route and the exercise submission route. Each of
them takes the learner's answer, not the learner's opinion of their
answer. Each checks enrolment first, refusing with a `NOT_ENROLLED` code
rather than silently recording. Each looks the activity up by id and
grades against the stored mark scheme, which the client has never been
sent, because `publicActivity` strips it on the way out.

That last part is what makes the whole arrangement hold together. It is
not enough for the server to grade. The server has to grade against
something the client never had, or a determined client just grades itself
correctly and sends a plausible answer.

---

## The Test That Belongs Here

There is a category of behaviour that is hard to test by asserting what a
route does, because the fix was to delete the route. The test that catches
a regression is one that asserts the route is **absent**, or one that
submits work without an enrolment and expects a refusal. Both are worth
writing, because the natural direction of drift is for somebody to add a
convenient endpoint back under a different name.

1. Anything the client asserts about its own achievement is a claim, and
   claims are inputs, not conclusions.
2. Validation checks whether a value is well formed. It does not check
   whether the caller had standing to send it.
3. Accepting a whole object where you meant to accept two fields hands the
   client every other field on that object, including the ones your
   permission check was protecting.
4. Grade on the server, against a mark scheme the client has never
   received. Server-side grading against data the client also holds is
   only half a fix.
