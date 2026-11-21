# Handoff — address review and local publication, 2026-11-11

## Read first

1. [S7 address review and auto-approval](./S7-address-review-auto-approval.md), especially §11 “Scope and audit findings”.
2. [Decisions — 2026-11-10/11](./DECISIONS-2026-11-07.md), last section “2026-11-10/11 — local address review and publication”.
3. [Directory Address Review operator runbook](../../operators/directory-address-review.md), especially “Known Limitations”.
4. [Local evaluation source review — 2026-11-08](./LOCAL-EVALUATION-REVIEW-2026-11-08.md), which records the approved 133-town local evaluation, October staging and unverified assignments.

## What happened in this thread

- The active 133-town Overture cohort (`182,277` private rows) originally retained only name, category, location and attribution.
- Four of the sixteen October assets cover all 133 towns: `00000`, `00001`, `00003`, `00006`.
- `scripts/local-directory-overture-contact-capture.cjs` re-read those four pinned assets and retained composed addresses (`freeform`, locality, region, postcode), websites, phones and minimal source provenance.
- `scripts/local-directory-address-review-active-seed.cjs` matched active rows by `(regionId, sourceFileRowNumber)` and created **179,125** new private candidates across **133 towns**.
- A stratified five-per-town evidence pass processed **663** new candidates and **785** processed rows in total, including the earlier pilot rows.
- **50** new candidates auto-approved and published; **3** earlier pilot rows were already published. The local directory now has **53 published candidates** and **57 private rows with `reviewed` fields** (the four manually reviewed September records plus the 53 candidate publications).
- The queue now has **179,247** candidates: **179,022** `needs_human`, **172** rejected, **53** published.
- **178,462** `needs_human` rows have not been through the evidence worker.

The user then asked for an audit against the design plan. The audit found P0/P1/P2 issues. The user chose **document only for this thread**: make no rollback or data changes now, but the next agent is expected to correct the findings in place, building on the existing queue and publications. No code or data was changed after that decision.

## Scope verdict

**In scope**

- The 133-town local evaluation, October staging, unverified assignments and local display exception were already approved and recorded in `LOCAL-EVALUATION-REVIEW-2026-11-08.md`.
- The contact re-capture is S7 slice 6 (“October retention and scale”).
- The user approved all-active-town public display, bounded HTTP evidence, rule-based risk with human review, and active-cohort seeding in this thread. Those approvals are now recorded in the 2026-11-10/11 decision section.
- Export remains disabled; no paid provider call was made; everything is local.

**Ahead of the written plan**

- S7 slice 5 says “measure precision on the four-town cohort, then enable the high-confidence tier.” Auto-approval was enabled at 133-town scale and 50 rows were auto-published without that measurement.
- S7’s publication gate required a fetched official page with name and address matches. A human-evidence fallback was added; the policy change is now recorded, but the quality/precision gate is still open.
- S7 requires every approval to be **auditable and reversible**. The pilot/import candidates are not properly bound to the rows they published, and published rows cannot be retracted from the owner console.

## Audit findings — all still present at handoff

### P0 — 120 pilot/import candidates are unanchored

- The September import gives candidates a **synthetic `scanId`** (`sha256(source:rowNumber)`).
- The artifact-mode seed stores the **September artifact row number** with the **October active scan ID**.
- **120** candidates fail the `(scanId, sourceFileRowNumber)` join to `directory_overture_private_row`.
- The three published pilot rows are affected. The candidate says row `3722864`; the reviewed fields were attached to active row `4148514`.
- `publishAddressReviewCandidate` resolves the active row by name/category/point and ignores the candidate’s source key. It publishes successfully while the audit record points at a different row.

Reproduce:

```sql
SELECT count(*)
FROM directory_address_review_candidate c
LEFT JOIN directory_overture_private_row r
  ON r."scanId"=c."scanId"
 AND r."sourceFileRowNumber"=c."sourceFileRowNumber"
WHERE r."scanId" IS NULL;  -- 120
```

Key files:

- `scripts/local-directory-address-review-import.cjs` (synthetic scan ID)
- `scripts/local-directory-address-review-active-seed.cjs` (artifact row number)
- `apps/directory/src/address-review-publish.ts` (name/point resolver)

### P0 — no town-containment gate

The engine compares the geocode to the **source point**, not the assigned town boundary. At least five published rows are in a different town than the listing:

| Listed under         | Actual address locality                                               |
| -------------------- | --------------------------------------------------------------------- |
| Valdosta, GA         | Quitman, GA — Advance Auto Parts, Food Lion, Western Motel of Quitman |
| Greer, SC            | Taylors, SC — Pizza Hut Express                                       |
| Kill Devil Hills, NC | Nags Head, NC — Nags Head Florist                                     |

The Kill Devil Hills case conflicts with the explicit decision to keep Outer Banks and Kill Devil Hills separate. The published subset is **5/53 = 9.4% wrong-town**, above the approved 5% limit. The full-frame measure has not been run.

Reproduce:

```sql
SELECT t.name AS town, c.name AS business,
       r.listing->'reviewed'->>'address' AS address
FROM directory_address_review_candidate c
JOIN directory_town t ON t."communityId"=c."communityId"
JOIN directory_overture_private_row r
  ON r."scanId"=c."scanId"
 AND r."sourceFileRowNumber"=c."sourceFileRowNumber"
WHERE c.status='published'
ORDER BY t.name, c.name;
```

(The three pilot rows are not returned by this join because their candidate keys are unanchored; they are still published on the active rows.)

### P1 — auto-approval before the precision gate

- The five-per-town sample processed 663 new rows: 50 auto-approved (7.5%), 135 rejected, 478 `needs_human`.
- There is no ground-truth precision measurement.
- The 5% wrong-town limit and the two-reviewer full-frame quality review remain outstanding.
- The local-evaluation exception allows display before the two-person review, but it is not a precision or quality acceptance.

### P1 — no published-row withdrawal

- `revoke` works only from `approved` or `auto_approved`.
- A `published` candidate cannot be retracted from the owner console.
- `OverturePrivateSink.withdrawRow` and `withdrawPolicy` exist, but no operator endpoint or UI uses them for a published listing.
- The 24-hour removal target and S7’s “removal from every visible surface” requirement are not met.

### P1 — decision record coverage

The 2026-11-10/11 approvals are now recorded in `DECISIONS-2026-11-07.md`. The quality/precision gap and the audit findings are recorded in S7 §11. There is still no formal ADR for treating this as an exception to the quality plan; add one only if the user asks.

### P2 — policy breadth and sink guardrail

- The public-display policy grants **all nine fields**, while the approval notes name address, website and phone. `alternate` is unnecessary; `primary` and `hierarchy` are required by the projection but are not served.
- `OverturePrivateSink` now has opt-in `includeContactFields` and `includeSourceProvenance`. The default still drops them and tests cover it, but the documented “never arbitrary source data” guarantee now depends on the caller’s option.
- The address composer duplicates some localities, e.g. `Dripping Springs, Dripping Springs, TX`. It appends locality even when `freeform` already contains it.
- The separate address-review secret required before production is still the local-evaluation secret. Fine for local; track it for S9.

## What not to do

- Do **not** roll back, delete, or reset the existing candidates, publications, `reviewed` fields, or decisions. The current local data is the baseline the next agent must repair and complete, not discard.
- Do **not** reset, clean, or create a worktree in this checkout. It is heavily dirty and contains other agents’ authorized work.
- Do **not** use `ot_social` for writes. Directory has its own database (`ot_directory`); the contact capture lives in `ot_directory_census_stage`.
- Do **not** enable export, paid provider calls, or public deployment. Export remains disabled; the local Docker stack is the only target.
- Do **not** treat the 53 published rows as a quality or precision acceptance.

## Next agent mandate — correct in place (required)

This is the assigned follow-up, not an optional cleanup. Start from the current
179,247-candidate queue and 53 published rows; do not roll them back. Work in
this order and keep the queue and public data consistent at each step.

Use this bounded order:

1. **Pause auto-approval and publication.**
2. **Repair candidate identity**
   - Change the import to resolve the active row and store its `scanId`/`sourceFileRowNumber`.
   - Change the artifact seed to store `active.sourceFileRowNumber`, not `row.sourceFileRowNumber`.
   - Add a publish guard: the candidate’s `(scanId, sourceFileRowNumber)` must resolve to the active row, and the resolved row must match name/category/point.
   - Add a regression test for a mismatched candidate key.
   - Repair the 120 existing candidates; the three published pilot candidates need their candidate/decision rows re-keyed while keeping the reviewed fields on the active rows.
3. **Add town containment**
   - Compare the geocode to the assigned town’s verified boundary when one exists.
   - Otherwise use the labeled Census place candidate as a local-evaluation heuristic.
   - If the geocode is outside the assigned town, withhold the address (or keep it explicitly unverified and out of the map).
   - Add a test with a neighboring-town address.
4. **Add published-row withdrawal**
   - Internal Directory endpoint, gateway route, owner-console action.
   - Remove the `reviewed` object from the active row, mark the candidate `revoked`, record the decision, and verify the public listing and map pin disappear.
5. **Address the quality gate**
   - Either run the four-town precision/full-frame review or record an explicit user waiver before resuming auto-approval.
6. **Tighten the policy/sink**
   - Document that `primary`/`hierarchy` are projection-required but not served; drop `alternate` from publicDisplay if the projection still passes.
   - Decide whether contact/provenance retention belongs in a dedicated capture sink rather than the shared sink.
7. **Re-run verification**
   - `directory:test-address-review`, `test-address-evidence`, `test-address-review-store`, `test-address-review-publish`, `test-overture-private-sink-unit`, `test-overture-private-sink` (disposable DB), gateway controller spec, owner-console spec.
   - `nx build directory`, `gateway`, `owner-console`.
   - `scripts/validate-typeorm-migrations.mjs`.
   - Rebuild/restart the Directory image and verify the public gateway.

### Acceptance criteria

- Every candidate's `(scanId, sourceFileRowNumber)` resolves to its active private row; the three published pilot candidates match the rows carrying `reviewed`.
- The publisher refuses a candidate whose source key does not resolve or does not match the resolved row.
- Address publication requires the geocode to fall inside the assigned town using the verified boundary or the labeled Census place candidate; obvious mismatches are withheld.
- The five wrong-town rows are corrected or their address fields are withdrawn; the gateway listing and map pin disappear when withdrawn.
- A published row can be withdrawn end to end from the owner console with an audit decision.
- The quality/precision gate is either run or explicitly waived by the user; no further auto-approval until then.
- Policy and sink documentation matches the actual permissions; tests, builds and migrations pass.

## Current state and constants

Databases:

- Live local review/serving: `ot_directory` on PostGIS container `town-square-directory-db`, host port `32768`.
- Contact capture: `ot_directory_census_stage` on the same container.
- Disposable test database used for the sink suite: `overture_test_sink` (template of `directory_address_review_dev`).

Current cohort constants:

| Constant                        | Value                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| Contact-capture policy          | `7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983`                  |
| Active private policy           | `66372b1d63cc9db88f91733a9d593cbfc3f60a0b4a38d1655e0deecf1df7f78b`                  |
| October public-display policy   | `docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json` |
| September public-display policy | `docs/plans/town-square-directory/policies/overture-public-display-2026-09-23.json` |
| Contact assets                  | `00000`, `00001`, `00003`, `00006`                                                  |
| Active October scans            | `d5b4d4de…`, `de7d0807…`, `e902857a…`, `beab6953…`                                  |

Operator entry points:

- Queue: `http://127.0.0.1:8084/dashboard/directory-address-review/<communityId>`
- Westerly, RI example: `6ea6c977-0e6c-4f9a-ab17-cb0ba83186b5`
- Gateway: `http://127.0.0.1:3000`
- Runbook: `docs/operators/directory-address-review.md`

Useful commands (derive the local password; never commit it):

```bash
export PW=$(docker exec town-square-directory-db sh -lc 'echo "$POSTGRES_PASSWORD"')
export STAGE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory_census_stage"
export LIVE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory"

# Queue status
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 32768 -U postgres -d ot_directory \
  -c 'SELECT status, count(*) FROM directory_address_review_candidate GROUP BY status ORDER BY count DESC;'

# Reproducible report
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" \
  node scripts/local-directory-address-review-queue-report.cjs

# Evidence worker (resumable, never publishes)
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
  node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-evidence.cjs \
  --per-town 5 --limit 2000 --census-delay 800 --page-delay 1000 \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json

# Publish dry-run
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
  node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-publish.cjs \
  --contact-stage "$STAGE" \
  --contact-policy 7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983 \
  --limit 100 \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json
```

Add `--apply --reviewer <uuid>` only after reviewing the dry-run and after the user authorizes publication. Human-approved rows use the latest human approver automatically; auto-approved rows need `--reviewer`.

## Verification performed

Passing at the recorded points:

- Address review: 16/16
- Address evidence: 10/10
- Risk classifier: 5/5
- Address-review store: 7/7
- Address-review publication: 6/6
- Sink unit: 6/6
- Sink Postgres: 14/14 (disposable `overture_test_sink`)
- Gateway controller: 5/5
- Owner-console component: 3/3
- `nx build directory`, `gateway`, `owner-console`
- `scripts/validate-typeorm-migrations.mjs`
- Directory container rebuilt and healthy; published data survived restart.
- Public gateway returned published addresses and coordinates for representative rows.

Not performed:

- Authenticated browser proof of the owner-console page; the internal queue was verified through the gateway container and the page route returns HTTP 200.
- Full 179k evidence pass; only the stratified sample was processed.
- Two-reviewer full-frame quality review.
- Precision measurement for the auto-approval tier.
- Published-row withdrawal.

## Decisions to confirm while correcting

These are confirmations for the next agent, not reasons to stop. Use the
recommended default if the user does not answer.

1. **Five wrong-town rows** — withdraw the five address fields after withdrawal is built (recommended), or correct the town assignment if the source evidence supports it. Do not leave them unchanged once withdrawal exists.
2. **Town containment** — required before any further address publication. Use the verified boundary where one exists, otherwise the labeled Census place candidate; withhold only clear mismatches.
3. **Quality/precision** — run the four-town review, or obtain an explicit user waiver (recommended: run the review). Do not resume auto-approval until one is chosen.
4. **120 unanchored candidates** — repair in place; required.
5. **Published-row withdrawal** — required before the next publication run.
