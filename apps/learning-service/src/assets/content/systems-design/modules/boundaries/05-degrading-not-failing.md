# Missing a Part Without Losing the Page

The default way to handle a failed call across a boundary is to let it
fail: propagate the error, return a 500, let the caller deal with it. That
default is correct more often than not, and every previous lesson in this
module has assumed it. But it is a default, not a law, and treating every
dependency as equally required produces pages that go dark for reasons that
have nothing to do with what the page was actually for. This lesson is
about the routes where that default is the wrong call, and how to tell them
apart from the routes where it is right.

---

## The Question to Ask of Every Dependency

For each call a route makes across a boundary, ask: if this one call fails
and everything else succeeds, is the response still useful? Not perfect,
useful. A course page whose lesson content loaded but whose author lookup
failed is still a course page a learner can read and enrol in. A checkout
whose payment call failed is not a checkout with a small gap in it; it is a
checkout that did not happen. The two failures are not the same shape, and
treating them the same way (fail the whole request either way) is only
correct for the second one.

---

## The Real Example

`getOffering`, in `apps/gateway/src/controllers/learning/learning.controller.ts`,
fetches a course's detail from the learning service and then asks the
profile service to resolve the author's display name, in parallel with
checking whether the caller is enrolled:

```ts
const [author, isEnrolled] = await Promise.all([this.resolveAuthor(detail.ownerProfileId), this.isEnrolledIn(viewer.profileId, offeringId)]);
```

`resolveAuthor` does not let a failed profile-service call propagate. It
catches the error and returns `null`:

```ts
private async resolveAuthor(
  ownerProfileId: string | undefined
): Promise<{ profileId: string; displayName: string } | null> {
  if (!ownerProfileId) return null;
  try {
    const profile = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.Get },
        { id: ownerProfileId, query: {} }
      )
    )) as { id?: string; profileName?: string } | null;
    const displayName = profile?.profileName?.trim();
    if (!displayName) return null;
    return { profileId: ownerProfileId, displayName };
  } catch {
    return null;
  }
}
```

The comment on this method states the trade directly: a course whose author
cannot be looked up still renders; it just does not say who wrote it.
Failing the whole page because the profile service is unreachable would be
a poor trade for one line of text. Note what the method did not do: it did
not retry, did not log a scary error and hope, and did not distinguish "the
profile service is down" from "this profile does not exist." Both collapse
to `null`, because for this route, the caller only needs to know whether to
show a name, not why one is unavailable.

---

## Why `getOffering` and Not `answerActivity`

Contrast this with the routes that grade a submission. `answerActivity` and
`submitExercise` have no equivalent fallback: if the learning service is
unreachable, they fail, and they should. There is no meaningful partial
result for "grade this answer" the way there is for "show this course page."
A grade that silently defaults to something is worse than no grade at all,
because it looks authoritative. The difference is not about which service
is more important in the abstract; it is about whether the specific piece of
data is required for the response to mean what it claims to mean.

`isEnrolledIn`, in the same route, is a middle case worth naming: it does
not have a `resolveAuthor`-style catch, so a failure there does propagate.
That is a choice, and arguably a debatable one, but it is at least a
deliberate line: enrolment status changes what the page offers the learner
to do next (enrol, or open a lesson), where the author's name changes only a
caption.

---

## Applying This Elsewhere

The pattern generalizes past this one controller. For any call across a
boundary, decide in advance, not in the moment of an incident, whether it is
load-bearing for the response or merely enriching it. Load-bearing calls
should fail loudly, because a silently wrong answer is worse than an honest
error. Enriching calls are candidates for a `catch` that returns a sensible
absence, exactly as `resolveAuthor` does, so one unrelated dependency being
down does not take an entire page down with it.

1. For every cross-boundary call in a route, ask whether the response is
   still meaningfully useful if that one call fails.
2. If yes, degrade: catch the failure and return an absence, like
   `resolveAuthor`'s `null`, rather than propagating.
3. If no, let it fail loudly. A fabricated grade or a silently skipped
   payment is a worse outcome than an honest error page.
