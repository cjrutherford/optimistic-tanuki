# What Silence Gives Away

There is a decision every protected route makes, usually without anyone
noticing it was a decision: when the caller is not allowed to have the
thing, do you tell them it exists?

The two answers look almost identical in code. One returns "you may not
have this." The other returns "there is no such thing." The difference is
one status code and, on a route that takes ids, a meaningful amount of
information.

---

## The Distinction

`403 Forbidden` says: this resource exists, and you cannot have it.
`404 Not Found` says: there is nothing here.

A 403 is more honest and often better product behaviour. If a colleague
sends you a link to a document you lack access to, "ask the owner for
access" is a far more useful answer than "this document does not exist,"
which sends you off to interrogate the colleague about a broken link.

But a 403 answers a question the caller was not entitled to ask. It
confirms existence. On resources whose existence is itself sensitive, that
confirmation is the disclosure, and the fact that no content came back
does not undo it.

---

## Where This Bit Here

This platform lets somebody author a course and work on it privately
before publishing. A draft course is visible to its owner and its
co-editors and nobody else. The catalog handles this correctly: unpublished
courses are filtered out of what a visitor sees.

Filtering the catalog turned out not to be enough. The lesson route takes
ids directly. `getLesson` in `apps/learning-service/src/app/app.service.ts`
now carries the comment that records why:

> Filtering the catalog is not enough on its own: this route takes ids
> directly, so without the same check an unpublished course was readable
> by anyone who knew a lesson id. That was true of the running service
> until the viewer argument was added here.

Read that last sentence again. It was not theoretical. The route was live.
Anyone who could guess or obtain a lesson id could read an unfinished
course, because the only thing hiding drafts was a filter on a different
route.

This is the general shape of the bug: a resource protected by being absent
from a listing, and reachable by a second route that takes an identifier.
The listing is the front door. The id route is the window nobody checked.

---

## The Answer It Gives Now

When the check fails, the route throws the same not-found error an unknown
lesson gets. The comment states the reasoning:

> The same answer an unknown lesson gets. Telling an outsider that a course
> exists but is not theirs to read is itself a disclosure.

For an unpublished course, that is the right call. The existence of a draft
is exactly what the author is entitled to keep private. Answering 403 would
tell a stranger that a course with that id is being written, which is the
one fact worth protecting.

The rules themselves live in `isOfferingVisibleTo` in
`libs/learning-domain/src/lib/learning-domain.ts`, in one place rather than
duplicated per route:

```ts
export function isOfferingVisibleTo(offering, ownership, viewer): boolean {
  if (offering.status === 'published') return true;
  if (viewer.seesEveryDraft) return true;
  if (!viewer.profileId || !ownership) return false;
  return ownership.ownerProfileId === viewer.profileId || ownership.coEditorProfileIds.includes(viewer.profileId);
}
```

Published is visible to everyone. A viewer who answers for the platform
sees every draft. Otherwise, only the owner and co-editors. Having this as
a function rather than a pattern each route reimplements is what made it
possible to add the check to the lesson route without rewriting the rule.

---

## Not a Universal Rule

The uncomfortable part of this lesson is that 404-for-everything is not
simply the safer choice you should always make. It has real costs:

- It makes legitimate access problems much harder to diagnose. "It does
  not exist" sends a user looking for a wrong link when the actual answer
  was "ask for access."
- It can be defeated anyway. If creating a resource with a taken name
  fails, the failure confirms existence through the back door. Hiding
  existence properly means hiding it everywhere, and that is more work
  than one status code.
- It hides real bugs. A route returning 404 because of a broken permission
  lookup looks exactly like a route returning 404 correctly.

The decision turns on whether existence is sensitive. For a draft course,
it is: the author is entitled to write in private. For a document inside a
team where everyone knows the document exists, a 403 with a request-access
path is better in every way.

What you should not do is let the choice be made by whichever branch was
easier to write.

---

## Timing Says Things Too

A route can answer 404 and still confirm existence, if it takes eleven
milliseconds for a resource that does not exist and ninety for one that
exists but is forbidden. The gap is the answer.

This matters far more for credentials than for course drafts, and it is
worth knowing about rather than worth chasing everywhere. If existence is
sensitive enough that you chose 404 deliberately, it is worth asking
whether the two paths do noticeably different amounts of work before
answering.

1. 403 and 404 are a design decision about whether existence is
   disclosable, not two spellings of "no".
2. Filtering a listing does not protect a route that takes ids. That is
   two doors, and the second one needs its own check.
3. Put the visibility rule in one function so every route can ask it
   rather than reimplement it.
4. Choose 404 when existence itself is the private thing, and accept that
   it costs you diagnosability.
