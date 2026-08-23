# learning-e2e

End-to-end tests for the Learning Studio client.

```bash
nx e2e learning-e2e
```

That is all it takes. The config starts `learning:serve-static` itself and
stubs the gateway at the network layer, so the tests need no database, no
services and no seeded data.

The stubs live in `src/learning.fixtures.ts` and are shaped to match what
`apps/gateway` really returns. If the gateway's contract changes, these should
fail rather than quietly drift.

## Against a real stack

```bash
BASE_URL=http://localhost:8080 nx e2e learning-e2e
```

With `BASE_URL` set the config skips its own web server and the specs run
against whatever is there. Note that the stubs still intercept, so this checks
routing and rendering rather than live data.
