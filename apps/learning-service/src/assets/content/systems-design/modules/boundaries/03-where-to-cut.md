# Cutting Along the Grain

Given a codebase that has grown large, the tempting rule for where to put a
boundary is size: this got big, split it. That rule produces boundaries that
cost everything the last lesson described and buy almost nothing, because
size is not the thing that made the split worth doing. This lesson argues
for a different rule: cut where ownership of data and rate of change already
differ, and let those differences tell you where the service already wants
to end.

---

## The Wrong Question

"How many files is this" and "how many lines is this" are questions about
the container, not about what is inside it. A learning service with a large
`typeorm.repository.ts` is not, by itself, evidence that repository should
become two services. Splitting on size alone tends to cut through things
that belong together (a query that joins two tables now has to join across
a network instead) while leaving things that do not belong together sitting
in the same process because neither side happened to be large.

The learning service in this workspace holds program tracks, offerings,
enrolments, activities, and lesson progress in one place. That is a lot of
surface area, but it is not, on its own, a reason to split it: all of that
data is written and read by the same set of operations, on the same
lifecycle (a learner enrolling, progressing, and being graded), by code that
already agrees on what an offering is.

---

## The Right Question: Who Owns This, and Who Changes It

Two better questions, asked of any candidate seam:

**Does one side own data the other side has no business writing?** The
gateway never touches the learning service's tables directly; every read
and write goes through a command like `LearningCommands.GetOffering` or
`LearningCommands.SaveLessonProgress`. That is already a real ownership
boundary, expressed as a TCP call, and it is why the gateway and learning
service are separate processes in the first place: profiles, sessions, and
throttling belong to the gateway's concerns, and course structure, progress,
and grading belong to the learning service's.

**Does one side change for reasons the other side does not?** The gateway
changes when the answer to "who is allowed to see this" changes: a new role,
a new throttle tier, a new session shape. The learning service changes when
the answer to "what is a course" changes: a new activity type, a new
progress rule. Those are different rates of change driven by different
forces, and that difference is what justified drawing the line between
gateway and learning service where it is, rather than, say, between
`offerings` and `enrolments` within the learning service itself, which
change together far more often than they change apart.

---

## A Line That Was Nearly Drawn Wrong

`listPrograms` in the learning service's repository is a useful cautionary
case for the same instinct in miniature, not across a network boundary but
across a data-ownership one within a single service. The catalog is built
from two sources: four courses shipped in code and any courses stored in the
`program_track` table. An earlier version treated a non-empty table as a
full replacement for the built-ins, which meant authoring one new course
made every shipped course disappear from the catalog. The fix merges both
sources into one map, keyed by id, with a stored row shadowing a built-in of
the same id. The lesson generalizes: code-owned defaults and database-owned
overrides are two different owners of "what courses exist," and the merge
had to say explicitly which one wins, rather than letting either one quietly
replace the other.

---

## Applying the Rule

When a codebase is proposed for a split, ask the ownership and rate-of-change
questions before asking the size question. If two pieces are owned by the
same actor, change for the same reasons, and are read and written together,
a boundary between them buys you the costs from the previous lesson and
little else. If two pieces are owned by different actors and change on
different schedules, the boundary is often already there in spirit, whether
or not it exists yet in deployment.

1. Ask who owns the data, not how many lines the file is.
2. Ask what makes each side change, and whether those reasons overlap.
3. Where a boundary already exists in ownership but not yet in deployment,
   that is a much stronger candidate for a cut than a large file with no
   ownership split at all.
