# Saying What You Did Not Check

Every lesson in this module has been about a way that "it works" can be
true and misleading at once: a suite that's green but didn't run
everything, a double that agrees with the code that shares its mistake, a
service that only proves itself when actually run, a fix only proven by
watching the right tests fail. The common thread is that verification is
always partial. The closing move isn't finding a way to make it total.
It's saying, out loud and specifically, where the boundary of what you
checked actually sits.

---

## "I Don't Know" Is Not the Same as "I Didn't Check"

Stating a limit is not a confession that the work is unfinished. It's a
distinct, useful claim: here is exactly how far the evidence goes, and
here is where it stops. Compare two ways of reporting the fix from the
previous lesson:

> "Fixed the answer-key leak, all tests pass."

> "Fixed the answer-key leak. Verified by removing the fix and confirming
> exactly the two withholding tests fail, with owner-access and draft
> visibility unaffected. Not verified: behavior for co-editors, since no
> test exercises that role against this endpoint yet."

The first sentence is true and nearly useless: "all tests pass" was
already true before this bug was found, since the original leak shipped
with a fully green suite. The second sentence carries the actual evidence,
in both directions, plus the one thing it doesn't cover. Someone reading
it knows exactly what they can rely on and what they'd need to check
themselves before touching co-editor access.

---

## Every Lesson in This Module Has an Edge

It's worth stating the edges of this module's own lessons plainly, because
that's the practice being taught:

- **`knowing/01`** argues a green suite only certifies what ran. It does
  not tell you whether what ran was the right set of tests to have,
  only that the ones present didn't fail.
- **`knowing/02`** shows a double drifting from the real service it
  stands in for. Asserting the double's shape matches the real service
  closes that specific gap; it does not prove the double's _behavior_
  matches under every input, only its interface.
- **`knowing/03`** shows a bug only a running service surfaced. Running
  the service once and reading the response is strong evidence for that
  one request, at that one moment; it is not evidence about every other
  endpoint, or about what a different caller's permissions would return.
- **`knowing/04`** shows a fix verified by watching it fail without the
  patch. That confirms the tests written cover the two cases they name;
  it says nothing about a third case nobody thought to test.

None of these lessons closes the gap completely, and none of them claims
to. Each closes one specific, nameable gap, and leaves the rest visible
rather than implied to be handled.

---

## Stating a Limit Is a Skill, Not a Formality

It's easy to append "known limitations: none noted" to a report and call
the box checked. The actual skill is narrower and harder: naming the
specific thing you did not check, in language specific enough that someone
else could go check it themselves without having to reconstruct your
reasoning from scratch. "Not verified: co-editor access" is checkable by
someone else in an afternoon. "There may be edge cases" is not checkable
by anyone, because it doesn't say which edges.

The discipline this takes is the same discipline behind every other lesson
in this module: knowing precisely what your evidence covers, because you
built the evidence yourself rather than inherited an assumption that it
covered more. Someone who ran the real service once, for one endpoint,
under one set of permissions, can say exactly that, because they know
exactly what they did. Someone who only ever read the code and trusted a
green suite has a much harder time stating the limit precisely, because
they never had a precise picture of the coverage to begin with. Stating
limits well is downstream of having actually done the narrower, more
specific verification this whole module argues for.

---

## Why This Belongs at the End of the Course

A design that ships with "here's what this doesn't cover yet" attached is
more trustworthy than one that ships silent, even though the silent one
looks more finished. Silence about limits doesn't mean there are none; it
means the next person inherits them without warning, the way the
`ON CONFLICT` merge in `change/03-drift.md` inherited a missing constraint
nobody had flagged, or the way `listPrograms` in `change/05` inherited an
empty-catalog bug nobody meant to introduce. Stating a limit costs a
sentence. Not stating it costs whoever hits the edge later the time it
takes to rediscover it the hard way.

1. A limit stated is information; a limit unstated is just a limit,
   waiting for someone else to find it without warning.
2. "Verified X, not verified Y" is a stronger and more useful report than
   an unqualified "it works," even when both are true as far as they go.
3. Closing a course by naming what it doesn't cover is not a weaker
   ending than a confident summary. It's the more accurate one, and
   accuracy is the actual deliverable of everything before it.
