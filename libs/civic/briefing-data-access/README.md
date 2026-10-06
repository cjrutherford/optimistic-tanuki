# @optimistic-tanuki/civic-briefing-data-access

Generated Angular client for the gateway's local-hub civic routes
(`/api/local-hub/*`, orval `civic` project: the `civic-briefing`,
`civic-community` and `civic-community-operations` tags). Do not edit
`src/generated/` by hand.

```bash
pnpm run get-openapi
pnpm exec nx run civic-briefing-data-access:generate
pnpm exec prettier --write libs/civic/briefing-data-access/src/generated/
```

Every local-hub route is also served under `v1/`. The orval project drops
those aliases and names each method after its controller method (`me`,
`latest`, `submit`), so there is one method per route.

The routes wrap each reply in `{ data }`; the generated reply types (for
example `EditionListReply`) carry it.

`src/lib/` holds what the generator doesn't produce: `problem` and
`problemCode` (what to tell someone when a request fails), the contribution
state and review-stage wording, `submissionKey`, `artifactUrl` and
`DENSITY_TARGET`.
