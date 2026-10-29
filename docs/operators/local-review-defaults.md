# Local review defaults

Run `pnpm docker:dev`, then `pnpm docker:dev:seed`. Both initialize missing local
secret defaults through `scripts/dev-env-defaults.mjs`. The ignored `.env` is
written with mode 0600. Secrets are independent random values and remain stable
on subsequent runs. Existing values of at least 32 characters are preserved.
No external provider credentials are invented. These defaults are for local
review, not production secret management. Never commit or share the file.

This checkout temporarily uses OT at http://localhost:18080 and TS at
http://localhost:8087. The OT callback base URL follows the configured port.
Changing the JWT signing secret invalidates old development sessions; sign in
again after refreshing the containers.

`DOCKER_DEV_SERVICES` in `.env` scopes this checkout's build/start list to OT/TS,
their shared owners, and dependencies required by the checked-in seed script.
It does not stop other containers. Clear only that setting to restore the broad
workspace startup; do not delete `.env` and lose the generated keys.

`DOCKER_DEV_EXTERNAL_SERVICES=postgres` explicitly uses the existing PostgreSQL
container already attached to this checkout's network. Startup checks its service
label, running state and network before excluding it from lifecycle management.
It does not rename, remove, recreate or move the other worktree's container.
The normal seed commands still write development data through the configured
services. Remove this opt-in when switching to a database managed by this project.

To restore OT's port after the unrelated service releases 8080, run
`node scripts/dev-env-defaults.mjs --ot-port 8080`, then refresh the stack.
The development Classifieds service explicitly uses `ot_classifieds`, which has
tracked migrations. The legacy `classifieds_db` is left intact. `ADDITIONAL_DBS`
scopes migration setup to the OT/TS owners and seed dependencies; it does not
baseline untracked legacy tables or delete their data.

The startup helper returns failure when Compose cannot start a selected service;
a zero exit status no longer masks that error.

## OT/TS review data

This checkout sets `DEV_SEED_SCOPE=ot-ts`. The core fixtures and required shared
seeders still run; the post-core phase uses the real OT/TS APIs to create two
clearly synthetic adult review accounts, a development locality, a sample listing
and a direct conversation. Other products' optional sample users and video
creation fixtures are outside this scope.

Use `OT_TS_REVIEW_OWNER_EMAIL` / `OT_TS_REVIEW_OWNER_PASSWORD` or
`OT_TS_REVIEW_MEMBER_EMAIL` / `OT_TS_REVIEW_MEMBER_PASSWORD` from your private
`.env` to review either app. Values are generated once and are not printed.
Existing configured platform-owner credentials are loaded from `.env`; the runner
parses it as data and exported environment values take precedence.

The local registry is generated under `.runtime-artifacts/local-dev`. It advertises
the current OT UI origin and the actual local Gateway HTTP endpoint, so seed
requests supply registered Origin headers without weakening authentication checks.
The seed state records owned fixture IDs for retries and refuses to reset an
unavailable existing review account or a suspended membership automatically.
