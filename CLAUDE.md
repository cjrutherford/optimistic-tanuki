# Working agreements for agents in this repository

## Never merge a pull request unless explicitly told to

Do not merge a pull request, enable auto-merge on one, or otherwise land it
unless the repository owner has specifically asked you to merge that PR.
Driving a PR to green and reporting that it is ready is the end of the job.
Pressing the button is the owner's decision.

This holds even when the PR is one you opened yourself, CI is fully green, the
branch is mergeable, and merging looks like the obvious next step. "Ready to
merge" and "merge it" are different instructions.

When reporting that a PR is ready, name who still has to act. Avoid phrasing
like "PR #N is merged" for a merge someone else performed — it reads as though
you did it. Prefer "you merged #N" or "#N was merged by <person>".

## Nx commands

Every Nx invocation in this workspace needs the daemon and plugin isolation
turned off, or it hangs:

```
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx <target> <project>
```

Coverage for one project is `nx test <project> -c ci`, which writes
`coverage/<coverageDirectory>/coverage-summary.json`. That directory comes from
the project's own `jest.config.ts` and is not always `coverage/<project-name>` —
several are nested (`coverage/libs/leads/data-access`,
`coverage/libs/payments/domain`, `coverage/libs/permissions/domain`). Read the
jest config rather than guessing the path.

## TypeScript

`noPropertyAccessFromIndexSignature` is on workspace-wide. Test doubles must be
described by a named interface, not an index signature such as
`{ [key: string]: jest.Mock }`, or every property access fails to compile.
