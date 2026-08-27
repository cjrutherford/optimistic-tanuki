# Why Nobody Should Write a Migration

There are two ways to produce a migration file. You can look at the schema
you want and the schema that exists, and hand-write the SQL that gets from
one to the other. Or you can point a tool at your entity definitions and
have it diff them against the live schema and emit the SQL itself. These
look like a style choice. They are not. One of them makes it possible for
the code's idea of the schema and the database's actual schema to quietly
disagree; the other doesn't.

---

## The Handwritten Path Has a Silent Failure Mode

Writing a migration by hand means writing down, a second time, in SQL, a
fact you already stated once in the entity's decorators. Nothing forces
those two statements to match. You can add an `@Index` to an entity and
simply forget to add the matching `CREATE UNIQUE INDEX` to the migration,
and nothing will tell you. The entity compiles. The migration runs
without error. Every test that builds its schema from the entities
(rather than by running migrations) will pass, because the index really is
there in the entity's world. Only the database, built by the migration
you actually wrote, is missing it.

This is not hypothetical for this codebase; it is the subject of the next
lesson in this module, and it is the single most convincing argument for
never hand-writing a migration again.

---

## Generation Removes the Second Statement

`apps/learning-service` has a `typeorm:migration:generate` target that runs
the TypeORM CLI against `apps/learning-service/src/app/staticDatabase.ts`:

```json
"typeorm:migration:generate": {
  "executor": "nx:run-commands",
  "options": {
    "command": "node -r ts-node/register -r tsconfig-paths/register ../../node_modules/typeorm/cli.js migration:generate -d src/app/staticDatabase.ts",
    "cwd": "apps/learning-service"
  }
}
```

Run it, and TypeORM connects to a live schema, reads every `@Entity`, and
emits the `ALTER TABLE` and `CREATE INDEX` statements needed to make the
database match what the entities declare. There is no second place to
write the fact down. The entity _is_ the source of truth, and the
migration is a mechanical consequence of it, not an independent
transcription that can drift from it.

`apps/learning-service/src/migrations/` now holds exactly one migration,
`1787753971919-InitialLearningSchema.ts`. It replaced seven hand-written
ones that had accumulated drift over time, in ways nobody had noticed
because nothing ran that would have caught it.

---

## Why This Is a Design Decision, Not a Tooling Preference

It's tempting to file "generate migrations, don't hand-write them" under
tooling taste, the same shelf as tabs versus spaces. It belongs somewhere
else. The design property being protected is that there is exactly one
place in the system where "what should the schema look like" is stated:
the entity. Everything downstream, the migration, the schema TypeORM
builds when a test uses `synchronize`, the actual production database
after the migration runs, is supposed to be a _consequence_ of that one
statement, not an independent restatement of it.

A hand-written migration breaks that property the moment it's written,
whether or not it happens to match the entity on the day it's written.
It's now a second place where the intended schema is stated, and the two
statements have no mechanism keeping them in sync as the entity continues
to change over the following months. Generation doesn't just save typing.
It removes the second place to state the fact, which removes the
possibility of the two statements disagreeing, because there's only one
statement left.

---

## What Generation Does Not Buy You

It would be a mistake to read this as "generated migrations are always
correct, so you can stop reading them." Generation removes exactly one
class of error: the entity and the migration disagreeing about intent. It
does not remove:

- **Whether the generated statement is safe to run against production
  data.** A generated `ALTER TABLE ... ADD COLUMN ... NOT NULL` on a large
  table is still a locking operation; the tool doesn't know your traffic
  pattern.
- **Whether the diff is what you meant.** If you connected the generator
  against a schema that was already out of date, it will happily generate
  a migration that "fixes" things you didn't intend to touch.
- **Whether the migration is well-formed as a file.**
  `scripts/validate-typeorm-migrations.mjs` still checks, on every
  migration directory, that the class name ends in exactly one 13-digit CLI
  timestamp, that the filename's timestamp matches it, that no two
  migrations share a timestamp, that the timestamp isn't a hand-typed date
  in disguise, and that files run in ascending timestamp order. Generation
  makes those checks pass by default; it doesn't make them unnecessary.

A generated migration is a migration you still have to read. It's just no
longer a migration you have to independently reconstruct from memory of
what the entity said.

---

1. If a migration and an entity can be written separately, they can
   disagree, and nothing will tell you until something depends on the
   difference.
2. Generation collapses "what the code says" and "what the migration says"
   into one statement, so there is nothing left to drift.
3. Reading the generated file, and running the naming and ordering checks
   on it, is still the job. Generation removes the copying error, not the
   review.
