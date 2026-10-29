# Authentication E2E cache baseline

**Result: locally verified (2026-10-18).** The Authentication E2E target inherited Nx caching from the `@nx/jest:jest` default, allowing a database-backed run to replay test output. The target in `apps/authentication-e2e/project.json` now sets `cache: false`. Resolved Nx configuration confirms that the target is uncached and CI `codeCoverage: true` remains enabled.

The 17 recorded prechecks passed, including 14 fast validators, 40 workflow-contract assertions, resolved-config assertions, formatting, and whitespace checks. The default command `pnpm exec nx run authentication-e2e:e2e:ci` then ran Jest against the fresh private B5 stack with no CLI or environment cache bypass. Both suites passed (21/21 tests, 1.576 seconds). Dependency build tasks may use their own cache; the E2E target itself executed.

Same-run `ot_social` readback found `saved_item`, `search_history`, `follow_entity`, `user_block`, and `user_mute` at zero before and after. Fifteen selected legacy fixture counters were zero after cleanup. Project-scoped teardown exited 0 and left zero containers, networks, and volumes. SMTP settings and send-pattern checks were empty, so email delivery was not tested.

An earlier wrapper attempt failed to resolve its artifact path before the Nx test target launched; scoped cleanup then succeeded. This is a harness failure, not a test or application failure. The corrected default-target run is the sole accepted cache-baseline runtime.

The changed host-side Nx config is separate from application provenance. The unchanged four service images remain the approved B5 images tied to the B5 base and five-path source overlay; the new config hash was not added to their labels, and no images were rebuilt or relabeled. See the [sanitized receipt](../evidence/df-007/e2e-cache-baseline.json).

This result verifies cache behavior for the generated-fixture E2E only. Legacy counters are selected fixture checks, not a full inventory. B5's [findings](./DF-007-B5.md) retain the exact cleanup limits: Account B ownership is checked separately without a second same-row readback, and OAuth/key-data cleanup has no post-delete absence assertion. No full account deletion, orphan cleanup, portable export, DF-007 acceptance, or RR-11 acceptance is established.
