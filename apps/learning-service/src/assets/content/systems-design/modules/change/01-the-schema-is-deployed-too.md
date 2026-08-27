# The Schema Ships Too

When you deploy a new version of a service, you think of the deploy as one
thing: build an artifact, ship it, watch it come up healthy. But if that
service talks to a database, every deploy that touches the schema is
actually two deploys happening at once, on two different clocks. The code
deploys in seconds and can be rolled back in seconds. The schema deploy is
neither.

---

## Rollback Is a Promise the Schema Often Can't Keep

"Roll back" means: return the system to the state it was in before the
change. For application code, that's close to true. Revert the commit,
redeploy the old artifact, and the old behavior is back.

For a schema, it's a much weaker promise, and sometimes not available at
all:

1. **Dropping a column loses data.** Rolling the code back does not restore
   what was dropped. The rollback and the original state are not the same
   state.
2. **A migration that ran against live traffic already changed rows.** If
   a migration backfills a new `status` column from an old boolean, "roll
   back" means either living with the backfilled values or writing a second
   migration to undo the first, live, under the same pressure that made you
   want to roll back in the first place.
3. **Two schema versions cannot both be "current."** Code rollback is
   instant because the old artifact still exists. A schema rollback is a
   forward change dressed up as a backward one: it is itself a migration,
   with its own risk, running while the system is already in trouble.

None of this means schema changes are too dangerous to make. It means the
safety net you have for code (revert, redeploy) does not exist in the same
form for the database, and treating a migration like a code change with a
free undo button is how a bad Tuesday becomes a bad week.

---

## Two Clocks, One Deploy Button

Pipelines tend to present a migration and a code deploy as one action:
click deploy, both happen. That framing is convenient and it hides a real
difference in how each half behaves once it starts.

The code half is reversible on a clock measured in seconds: redeploy the
previous artifact and the previous behavior is back, because the previous
artifact still exists in full. The schema half runs on a clock measured in
however long it takes to design, review, and run whatever undoes it, if
anything can. Pretending these are one clock because they're triggered by
one button is exactly what makes a bad migration land at the worst
possible time: someone assumes "just roll it back" applies to both halves
equally, discovers under pressure that it only applies to one, and now the
rollback itself is a novel, untested change being made live.

Naming the two clocks separately, before anything goes wrong, is what
makes it possible to plan for the difference instead of discovering it
during an incident.

---

## The Deploy That Actually Ships

Consider what a deploy of `apps/learning-service` really consists of when it
includes a migration: the compiled service artifact, and a SQL statement
that alters a table millions of rows might already be living in. The
service artifact is versioned, reviewed, and reproducible from source. The
migration is a one-way door: once it runs against production data, there is
no artifact to swap back to that undoes it, only another migration that
tries to.

```sql
-- a migration is not "config" or "a detail" of the deploy.
-- it is the deploy, on a resource nothing else in the
-- system can instantly replace.
ALTER TABLE lp_lesson_progress
  DROP COLUMN legacy_score;
```

Once that runs, the old column, and whatever depended on it, is gone. If
the new code turns out to be wrong, redeploying the previous version does
not bring `legacy_score` back. The rollback story for the _code_ was
solved on day one of using version control. The rollback story for the
_data_ has to be designed, migration by migration, or it does not exist.

---

## The Question That Actually Matters Isn't "Can I Roll Back"

It's tempting to try to force every migration into having a clean undo:
write a down-migration for everything, test the down-migration as
carefully as the up-migration, and treat "fully reversible" as the bar a
migration has to clear before it ships. For some migrations that bar is
reachable. For others, like the `DROP COLUMN` above, it isn't, no matter
how much engineering goes into the down-migration, because the data the
down-migration would need to restore is gone the moment the up-migration
commits.

The more useful question is not "can this be undone" but "what does the
system need to be able to do while this change is in flight, and what does
it need to be able to do if this change turns out to be wrong." Those two
questions have honest answers even for a migration with no real undo:
"nothing reads the new state until it's proven," or "the old behavior
keeps working until we've confirmed the new one is right," or, worst case,
"we accept this is one-way and we're going to be careful about exactly
when it runs." `change/04-expand-and-contract.md`, later in this module,
lays out one concrete answer to that question in full. This lesson is
about noticing the question needs asking before the migration ships, not
after it's already run against production data.

---

## What This Changes About How You Write a Migration

Once a migration is understood as a deploy with a much smaller rollback
budget than the code around it, a few habits follow directly:

1. **Ask what happens if this fails halfway.** A migration that adds a
   column and a migration that adds a column and drops another are not
   equally risky, even though both are "one migration."
2. **Ask what happens if the new code needs to roll back after this has
   already run.** If the answer is "the old code breaks against the new
   schema," the migration and the code deploy are not actually independent,
   no matter how they're packaged.
3. **Prefer changes that are safe to leave half-done.** A column that's
   been added but isn't read yet is a safe intermediate state. A column
   that's been dropped is not; there is no intermediate state, only before
   and after.

Notice that none of these three habits argue for avoiding migrations, or
for slowing every schema change down to a crawl. They argue for treating
the migration as the part of the deploy with the smaller rollback budget,
and sequencing accordingly: the riskier change happens in the step that's
cheapest to leave half-finished, not the step where an outage is already
in progress.

The next lesson in this module looks at where the migration file itself
comes from, and why letting it be generated from the entities, rather than
written by hand, closes off an entire class of mistakes before you get to
the question of rollback at all.
