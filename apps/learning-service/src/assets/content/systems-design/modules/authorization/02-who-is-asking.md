# The Answer Depends on Who Is Asking

The previous lesson argued that authorization needs the thing, not just the caller's identity. This lesson pushes on a sharper version of the same point: the same route, hit with the same id, has to return a genuinely different answer depending on who is asking, and treating that as an edge case rather than the normal shape of the problem is where authorization code goes wrong.

The clean version of this is easy to accept in the abstract. Owners see more than strangers; that's obvious. What's less obvious, and worth an entire lesson, is a case where the "obvious" fix, stripping sensitive fields from everyone equally, was actually the wrong answer, and the wrong version fails in a way that never raises an error and quietly destroys an author's own work.

---

## One Route, Two Legitimate Answers

`getOfferingDetail` in `apps/learning-service/src/app/app.service.ts` serves one endpoint, `GET /learning/offerings/:offeringId`, and it has to answer correctly for two very different callers: a learner looking at a course page, and the author who wrote the course, possibly using the very same route to load the course back into the editor. Here's the split, straight from the method:

```typescript
// The author gets their own course back whole. Everyone else gets it
// without the mark scheme.
const isOwner = Boolean(viewer.profileId && ownership?.ownerProfileId === viewer.profileId);
const visibleOffering = isOwner ? offering : { ...offering, activities: offering.activities.map(publicActivity) };
```

`publicActivity`, defined in `libs/learning-domain/src/lib/learning-domain.ts`, strips the correct answers out of each activity: `expectedOutput` from a code exercise, `correctOptionIds` from a multiple-choice quiz, `sampleResponse` and `rubric` from a written response. A learner fetching the offering gets activities with the mark scheme removed. The owner, or a co-editor, gets the offering exactly as it's stored, mark scheme and all.

Same route, same id, same shape of response, and the content genuinely differs by who's asking. That's not an inconsistency to fix. It's the correct behavior, and any version of this route that returns the identical payload to everyone is wrong for one of the two audiences.

---

## Why "Just Strip It From Everyone" Was the Wrong Fix

Before this split existed, the route returned the offering exactly as the catalog holds it internally, mark scheme included, to anyone who asked, signed in or not, closed in commit `cf1562af`. The obvious-looking fix is to apply `publicActivity` unconditionally: strip the answers before the response leaves the service, full stop, for every caller.

That fix is wrong, and it's wrong in a way that's worse than the bug it replaces, because of one detail: the course editor loads a course through this same route and saves it back as a full replacement. If the response had the mark scheme stripped from everyone, an author opening their own course to make a small edit would load a copy with no correct answers in it, edit something unrelated, and save. The save writes the stripped copy over the original. No error at any point. Nothing in the response, the request, or the logs would say "you just deleted your quiz's answer key." The author would find out only when a learner took the quiz and every answer was marked wrong, or right, arbitrarily, because there was no answer to check against anymore.

That's the trap worth sitting with: a security fix applied without asking who needs the field can silently destroy the very data it was trying to protect. The failure mode isn't an error message. It's data loss with no signal attached to it.

---

## The Actual Fix Reads the Caller, Not Just the Resource

The correct version isn't "strip the field" or "don't strip the field." It's "strip the field for readers who aren't the owner, and leave it whole for the one caller who's allowed to see it and needs it to keep working correctly." That requires the route to know who's asking before it decides what to return, which is exactly the authorization lesson from before, applied to a response body instead of a write.

The commit that introduced this split, `cf1562af`, is explicit about the tradeoff in its own words: "Stripping it from everyone would have been worse in a quieter way. The course editor loads from this same route and saves activities back as a full replacement, so an author opening their own course would have saved the stripped copy over their own answers the next time they touched anything. The owner gets the offering whole; everyone else gets it through publicActivity."

---

## Generalizing Past This One Route

The instinct to reach for a single, simplest-possible response shape (one endpoint, one payload, same for everybody) is usually good hygiene. It stops being good hygiene the moment a caller's identity changes what correctness even means for that response. Two questions catch this before it ships:

- Does any caller of this route need the full record to do their job correctly, not just to view it, but to write it back?
- If a stripped version reaches that caller, what breaks, and does it break loudly or silently?

If the answer to the second question is "silently," the single-shape response isn't a simplification. It's a data-loss bug waiting for the one caller who was never supposed to see the stripped version.

1. The same route, the same resource, can have more than one correct response, depending on who's asking.
2. Stripping sensitive fields uniformly looks like the safe default, but it's only safe if no legitimate caller needs the full record to function.
3. In this workspace, the course editor round-trips the offering it reads, so a stripped read becomes a stripped write, with no error to flag it.
4. The right fix reads the caller's identity and relationship to the resource before deciding what shape to return, not after.
