# Project at the Edge, Not in the Middle

A server usually needs more of a record than it should ever send. The
grading code needs the answer key. The page rendering the question must
never see it. Both are reading the same activity out of the same catalog.

So somewhere between the store and the wire, the record has to lose
something. Where you put that "somewhere" determines whether you have one
place to get right or a dozen.

---

## Two Places It Could Go

**Strip it at the source.** Never load the answer key in the first place,
or drop it the moment it leaves the database. Safe, and it makes the
grading code impossible to write, because grading is the one caller that
needs exactly the thing you threw away.

**Strip it at the edge.** Keep the record whole internally and project it
on the way out. Every internal caller gets what it needs. The cost is that
"the way out" is not one place. It is every route that returns the record,
and the protection is only as good as the least careful of them.

This platform chose the edge, and the comment above the projection helper
in `apps/learning-service/src/app/app.service.ts` says why:

> listPrograms itself stays whole, because grading reads activities back
> out of it by id and needs the answers. This runs at the edges, on what
> is about to leave the service.

The projection is `publicActivity` in
`libs/learning-domain/src/lib/learning-domain.ts`. It strips
`expectedOutput` from a code exercise, `correctOptionIds` from a
multiple-choice question, and `sampleResponse` and `rubric` from a written
one. A project submission has no mark scheme to remove and passes through
unchanged.

---

## The Edge That Was Missed

The weakness of edge projection is exactly what you would predict, and it
is what happened.

Three routes applied `publicActivity`: the catalog, the per-viewer catalog,
and the lesson route. A fourth did not. `getOfferingDetail`, which serves
the course page, returned the offering exactly as `listPrograms` holds it.
Whole. Including every answer key.

Nothing failed. Every test passed. The route had been reviewed. It was
found by fetching a course from the running service and looking at which
keys came back in the JSON:

```
writing.response   keys: [id, lessonId, maxWords, prompt, rubric, sampleResponse, type]
quiz.mcq           keys: [correctOptionIds, id, lessonId, options, prompt, type]
```

`sampleResponse` and `correctOptionIds` on a public route, readable
without signing in, for every course on the platform.

This is the tax edge projection charges. Three correct call sites and one
missed one is not a partial success; the missed one serves the same data
the other three were protecting.

---

## Why the Obvious Fix Was Wrong

The fix appears to be one line: apply `publicActivity` and move on.

That fix would have been worse than the bug.

The course editor loads from this same route. When an author saves, the
editor sends the activities back as a **full replacement** of what the
course contains. So an author who opened their own course would have
received a copy with their mark schemes stripped, changed a title, hit
save, and written the stripped copy over their own answers.

No error. The save succeeds. The mark schemes are simply gone, and nobody
finds out until a learner is graded against nothing.

A leak can be closed after the fact. Deleted data cannot be recovered.
The one-line fix would have traded a disclosure for silent data loss and
looked correct doing it.

The actual fix makes the answer depend on the caller: the owner receives
the offering whole, everyone else receives it projected.

```ts
const isOwner = Boolean(viewer.profileId && ownership?.ownerProfileId === viewer.profileId);
const visibleOffering = isOwner ? offering : { ...offering, activities: offering.activities.map(publicActivity) };
```

---

## The Design Problem Underneath

One route serving two audiences with opposite requirements is the actual
defect. The public page must not see the mark scheme; the editor must.
Making the response depend on the caller is a legitimate resolution.
Splitting into a public route and an authoring route would have been
another.

What is not legitimate is picking either one without checking every
consumer, and in particular every consumer that **writes back what it
reads**. A read-only consumer given less data renders less. A
read-modify-write consumer given less data destroys the difference.

That is the question to carry out of this lesson. Not "is this response
safe to send," but "what does each caller do with what I send it, and is
any of them going to send it back?"

---

## Making the Edge Countable

Edge projection only works if the edges are enumerable. Some things that
help:

- Keep the projection in one function so no route hand-rolls a variant
  that forgets a field. `publicActivity` is a single switch over activity
  type, so adding a new type with a mark scheme forces the decision.
- Test the shape of what routes actually return, not just the status
  code. The test that now guards this asserts the absent keys directly.
- Check the running service. This bug survived a full green suite and was
  visible in ten seconds of looking at real JSON.

1. Internal code often needs more of a record than any caller should
   receive, which is what makes edge projection the practical choice.
2. Edge projection is only as strong as the least careful route, and the
   route that gets missed serves the same data as the ones that did not.
3. Before changing what a route returns, find every consumer, especially
   any that saves back what it loaded.
4. A fix that silently deletes data is worse than the leak it closes.
