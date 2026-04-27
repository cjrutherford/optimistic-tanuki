---
id: admin-troubleshooting
title: Troubleshooting
slug: troubleshooting
parent: admin-operations
summary: Common recovery steps when the local environment does not come up cleanly.
order: 40
---
# Troubleshooting

If the platform does not come up as expected:

1. Confirm containers are running with `pnpm run docker:dev:ps`.
2. Tail logs with `pnpm run docker:dev:logs`.
3. Re-run `pnpm run docker:dev:seed` if shared data is missing.
4. Rebuild with `pnpm run docker:dev` if artifacts are stale.
