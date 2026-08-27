# Adding a Thing That Removes a Thing

The most dangerous kind of regression isn't the one where you change
something and it breaks. It's the one where you add something, purely
additively as far as anyone reviewing the change can tell, and the act of
adding it removes something else that was already working. Nobody
proposed removing anything. Nobody would have approved removing it. It got
removed as a side effect of code that was, in its own terms, correctly
implementing the new feature.

---

## The Feature: Let People Author Courses

`listPrograms` in `apps/learning-service/src/app/typeorm.repository.ts`
returns the catalog of courses the learning service offers. The service
ships with four built-in tracks. The feature being added was straightforward:
let instructors author their own tracks and store them, so the catalog
isn't limited to what shipped in the code.

The naive way to implement "read the catalog" once there's a table for
stored courses is to read the table:

```typescript
// what listPrograms used to do, roughly
async listPrograms(): Promise<ProgramTrack[]> {
  const rows = await this.programTrackRepo.find();
  if (rows.length > 0) {
    return rows
      .map(toProgramTrack)
      .filter((track) => Boolean(track.repositoryUrl));
  }
  return builtInProgramTracks;
}
```

Read in isolation, every line makes sense. If there are stored rows, use
them; the `repositoryUrl` filter was there to exclude some malformed rows
that had shown up during earlier development. If the table is empty, fall
back to the built-ins. This passed review, because reviewed in isolation,
each line is defensible.

---

## What It Actually Did

The moment anyone authored a single course, `programTrackRepo.find()`
returned a non-empty array. `rows.length > 0` was now true. The four
built-in tracks were never consulted again: the code had, without saying
so anywhere, decided that a non-empty table was a _replacement_ for the
built-ins rather than an _addition_ to them. Then the `repositoryUrl`
filter ran, and a freshly-authored course, which by definition has no
upstream repository, doesn't have one either. It got filtered out too.

The result: the first time anyone used the new authoring feature, the
catalog went from four courses to zero. The feature that was supposed to
let the catalog grow made it empty, and it did so exactly _because_ it
worked: the code executed precisely as written, no exception anywhere.

---

## The Fix Is a Merge, Not a Branch

```typescript
async listPrograms(): Promise<ProgramTrack[]> {
  const rows = await this.programTrackRepo.find();
  const merged = new Map<string, ProgramTrack>();
  for (const track of builtInProgramTracks) merged.set(track.id, track);
  for (const row of rows) {
    const track = this.readStoredTrack(row);
    if (track) merged.set(row.trackId, track);
  }
  return [...merged.values()];
}
```

There's no branch on whether the table is empty. Built-ins go into the map
first; every stored row goes in after, keyed by id, so a stored row with
the same id as a built-in shadows it (an edit) and anything else stored
adds to the set. There is no code path left in which storing one thing
causes four other things to stop being returned.

The test guarding this pins it structurally, not just with an example:
the built-in catalog is asserted to only ever grow, with per-track lesson
counts pinned at 38, 49, 24, and 25. Pinning each track's count separately
matters: a test that only checked a total lesson count could pass with one
track losing lessons while another happened to gain the same number, and
the regression would hide inside a coincidence.

---

## Why "It Passed Review" Wasn't Enough

Nobody who reviewed the original `listPrograms` change was careless. Each
line does what it says: check if there are rows, use them if so, fall back
to built-ins if not, filter out malformed entries. A reviewer reading
top to bottom, checking each line against its own stated purpose, has no
local signal that anything is wrong. The bug isn't in any single line;
it's in the interaction between "non-empty table" and "authored courses
have no repositoryUrl," two facts that live in different parts of the
codebase and were never stated next to each other.

That's the general shape of this entire class of bug: each participating
piece is locally correct, and the failure only exists at the level of
"what happens when both of these are true at once." Line-by-line review
is good at catching a wrong line. It's much weaker at catching a correct
line whose correctness depends on an assumption (the table is usually
empty, or authored courses will always have a repositoryUrl) that nothing
in the diff states out loud and that becomes false the moment the feature
being added is actually used.

---

## The General Shape

Ask, of any change that reads "if there's data, use it; otherwise, fall
back": what happens the instant the first row of new data appears? If the
answer is "everything that used to be returned by the fallback stops being
returned," the fallback was never a fallback, it was the only thing keeping
the feature from deleting the baseline. A merge that combines both sources
by key doesn't have that failure mode, because there's no threshold at
which one source silently replaces the other.

1. A branch on "is there any new data yet" is a branch that changes
   behavior for everyone, the moment one row exists, whether or not that
   was the intent.
2. Prefer a merge keyed by identity over a fallback keyed by presence;
   a merge has no all-or-nothing threshold to accidentally cross.
3. Pin the baseline in a test with enough granularity that one part
   shrinking can't hide behind another part growing.
