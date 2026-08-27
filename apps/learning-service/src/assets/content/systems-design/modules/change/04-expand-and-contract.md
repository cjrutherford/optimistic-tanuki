# Changing a Column Without Stopping

Say a table has a column, and you've decided its name, its type, or its
shape is wrong. The temptation is to fix it in one migration: rename the
column, or change its type, deploy, done. That migration only works if
every process reading and writing that table is running the new code at
the exact instant it runs. In a system with more than one instance, a
rolling deploy, or more than one service touching the table, that instant
does not exist. Old code and new code run side by side for the length of
the deploy, sometimes for much longer, and a one-step change to a column
breaks whichever version is still running the old assumption.

Expand-and-contract is the discipline of never requiring that instant.

---

## The Six Steps

Each step below is independently deployable. Each one leaves the system in
a state where both the old code and the new code work correctly against
the schema as it exists at that moment.

1. **Expand.** Add the new column (or table, or index) alongside the old
   one. Nothing reads it yet. This is pure addition; nothing that already
   works can break.
2. **Write both.** Change the code so every write path writes the new
   column and the old column together. Old readers still see a
   correctly-maintained old column. New readers, once step 3 ships, will
   see a correctly-maintained new column.
3. **Backfill.** Populate the new column for every row that existed before
   step 2 started writing it. This is the one step that touches historical
   data instead of just new writes, and the reason it comes after "write
   both" rather than before: backfilling first would let new writes
   arriving during the backfill go to the old column only, and the
   backfill would miss them.
4. **Move reads.** Change read paths, one at a time, to read the new
   column instead of the old one. Because step 2 has been keeping both
   columns correct since before this step started, every read path can
   switch independently, in any order, without a moment where a reader
   sees a column that isn't populated yet.
5. **Stop writing the old.** Once nothing reads the old column, stop
   maintaining it. This is safe only because step 4 is complete: if
   anything still reads the old column, this step breaks it.
6. **Contract.** Drop the old column. This is the only step that is not
   reversible in the way the code deploy around it is, which is why it
   comes last, after every other step has had time to prove itself against
   real traffic.

```text
expand ─▶ write both ─▶ backfill ─▶ move reads ─▶ stop writing old ─▶ contract
  │                                                                      │
  └──────────── every step here is safe with old and new code ──────────┘
                running at once; only the last step is a one-way door.
```

The same six steps, shown by what each version of the code sees rather
than by what the step does:

| Step                | What old code sees               | What new code sees               | Safe to stop here?                                 |
| ------------------- | -------------------------------- | -------------------------------- | -------------------------------------------------- |
| 1. Expand           | Old column only, unchanged       | Old column only, unchanged       | yes, new column is unused                          |
| 2. Write both       | Old column, correctly maintained | Old column, correctly maintained | yes, new column fills in from here forward         |
| 3. Backfill         | Old column, correctly maintained | Old column, correctly maintained | yes, new column now complete for old rows too      |
| 4. Move reads       | Old column, correctly maintained | New column, correctly maintained | yes, both columns still correct                    |
| 5. Stop writing old | Old column, now stale            | New column, correctly maintained | yes, as long as nothing still reads the old column |
| 6. Contract         | Column is gone                   | New column, correctly maintained | no, this step is the one-way door                  |

Every row up through step 5 answers "yes": old code and new code each see
a column that is correct for what they expect, at the same moment. Step 6
is the only row where stopping mid-step leaves something broken, which is
exactly why it comes last.

---

## The Failure Mode Each Step Prevents

It's worth walking through what specifically goes wrong if a step is
skipped, rather than treating the sequence as ceremony:

- **Skip "expand," add and populate in one step:** the column exists with
  data in it before any code knows to maintain it going forward, so the
  first write from old code after the column appears leaves it stale
  immediately.
- **Skip "write both," backfill once and move on:** every row that existed
  at backfill time is correct; every row written afterward, until reads
  move over, is only correct in the old column. The new column silently
  falls behind the moment the backfill script finishes.
- **Skip "backfill," go straight to moving reads:** readers switch to a
  column that's only populated for rows written after step 2 started.
  Every older row looks empty to the new code, not wrong, just missing.
- **Skip "move reads," stop writing the old column anyway:** the new
  column is now the only one being maintained, but old code, still
  reading the old column because nothing told it to switch, sees data
  that stopped updating.

Each of those is a silent failure, not a crash: stale data, missing rows,
a column that quietly stopped being current. That's the same pattern as
the drift lesson earlier in this module. Expand-and-contract isn't
protecting against errors; it's protecting against exactly this kind of
quiet divergence between what two versions of the code believe about the
same column.

---

## What This Buys You

The property expand-and-contract is protecting is this: at every point
between step 1 and step 6, you could stop, leave the system exactly as it
is, and it would keep working. A deploy that only gets through step 3
before something goes wrong is not a half-finished, broken migration; it's
a schema with an extra column nobody's reading yet, which is a completely
safe thing to leave sitting there while you investigate.

Compare that to the one-step version: rename the column in a single
migration, deploy the code that expects the new name at the same moment.
If the migration runs before every instance of the old code has drained,
the old instances start failing every query against that table, in
production, immediately, for however long the rollout takes. If the code
deploy finishes before the migration runs, same failure, opposite
direction. There is no safe order for a one-step change under a rolling
deploy; the two halves have to land at literally the same instant, and
"the same instant" is not a thing a rolling deploy can promise.

---

## Where the Steps Are Allowed to Compress

Not every change needs all six steps done as six separate deploys. A
column nothing reads yet, added on a system taken briefly offline for
maintenance, doesn't need the ceremony. What determines whether you need
the full sequence is whether old and new code can be running
simultaneously against the schema at any point in the rollout. If they
can, and in any system with more than one running instance they can, each
step needs to be a state both versions survive.

1. Never make old code and new code disagree about what a column means at
   the same moment; that disagreement is where the outage lives.
2. The backfill step exists to cover history; the write-both step exists
   to make sure history stops growing before you go back and fix it.
3. The only truly irreversible step is the drop. Every step before it is
   cheap to leave sitting, mid-sequence, for as long as you need.
