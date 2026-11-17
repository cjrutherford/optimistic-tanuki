---
title: Directory Address Review
summary: Review, approve, reject, and publish Overture address candidates for Town Square directory towns.
category: operators
audience: operator
section: operators
parent: docs/operators/overview
docRole: runbook
order: 5
tags:
  - directory
  - address-review
  - moderation
---

# Directory Address Review

Use this runbook to work the Town Square directory address-review queue and to
publish the address, website and phone fields that reviewers approve.

The design, decision thresholds and rollout evidence live in
[the S7 address-review plan](../plans/town-square-directory/S7-address-review-auto-approval.md).
This page is the operator procedure.

## What The Pipeline Does

```text
contact capture -> review candidates -> evidence worker -> human review -> publish
                        |                    |                 |
                  private queue        geocode + official   approve / reject
                                       page checks          / needs info / revoke
```

- **Capture** re-reads pinned Overture assets and retains the source address,
  website, phone and minimal provenance in the private stage database.
- **Seeding** matches those contacts to active private rows by
  `(regionId, sourceFileRowNumber)` and writes private review candidates.
- **Evidence** geocodes the address and fetches the first official page with
  robots, rate-limit, timeout and bot-detection controls.
- **Human review** records an attributed decision against one candidate.
- **Publish** attaches only the reviewed fields to the active private row,
  behind the approved public-display policy. Nothing is exported.

## Before You Start

- The local stack is running and the Directory service is healthy.
- The Owner Console is reachable at `http://127.0.0.1:8084`.
- You are signed in to the Owner Console. The gateway checks both the session
  and the `x-ot-appscope: owner-console` header that the app sends.
- The public-display policy is present at
  `docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json`.
- Export remains disabled. This is a local-evaluation workflow, not a
  production release.

Export the database handles once per shell. The values are local container
credentials; do not commit them.

```bash
export PW=$(docker exec town-square-directory-db sh -lc 'echo "$POSTGRES_PASSWORD"')
export STAGE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory_census_stage"
export LIVE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory"
```

The current 133-town cohort uses these constants:

| Constant | Value |
| --- | --- |
| Contact-capture policy | `7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983` |
| Active private policy | `66372b1d63cc9db88f91733a9d593cbfc3f60a0b4a38d1655e0deecf1df7f78b` |
| Public-display policy | `overture-public-display-2026-10-21.json` |

Re-derive the capture and active policy IDs if the release, region manifest or
projection changes. Do not carry them across releases.

## Open The Queue

Use **Owner Console → Community Ops → town → Review Addresses**, or open the
route directly:

```text
http://127.0.0.1:8084/dashboard/directory-address-review/<communityId>
```

Example: Westerly, RI.

```text
http://127.0.0.1:8084/dashboard/directory-address-review/6ea6c977-0e6c-4f9a-ab17-cb0ba83186b5
```

The queue is per town and paginated at 25 candidates. The status bar filters:

| Filter | Meaning |
| --- | --- |
| Needs review | Unresolved candidates waiting for a human or for evidence |
| Auto-approved | Passed every automated check, waiting for publication |
| Approved | A human approved it, waiting for publication |
| Published | Reviewed fields are attached to the active row |
| Rejected | A human or the engine rejected it |
| Revoked | A human withdrew an approved candidate |

A fresh town usually has hundreds or thousands of **Needs review** rows. Start
with towns where the directory page is visible, or work the sample towns first.

## Read A Candidate

Each card shows:

- **Source**: the source address (composed as street, locality, region,
  postcode), point, phone, website and source row.
- **Verification**: rights, geocode status and distance, official evidence
  status and link. `HTTP evidence` marks an HTTP page.
- **Risk**: residential, sensitive and adult. `unknown` means the rule
  classifier refused to clear it.
- **Automated reasons**: every failed or unknown check.
- **Checks**: the per-check `pass` / `fail` / `unknown` result.

The reviewer must compare the source record, the map point and the official
page. Do not approve from the business name alone.

## How The Engine Decides

The pure decision engine is `apps/directory/src/address-review.ts`. It records
every check as `pass`, `fail` or `unknown`, then applies:

| Result | Rule |
| --- | --- |
| `auto_approve` | Every check passes |
| `reject` | Any check fails |
| `needs_human` | No check fails, but at least one is unknown |

The gates that matter in practice:

| Gate | Pass condition |
| --- | --- |
| Rights | `publicDisplay` covers every relevant source field |
| Risk | Residential, sensitive and adult are explicitly `false` |
| Address shape | At least one valid address; a single address is required for auto-approval |
| Geocode | Census returns exactly one match within the precision threshold |
| Geocode distance | ≤ 1,000 m for range/street, ≤ 150 m for rooftop, ≤ 2,000 m hard maximum |
| Official evidence | Page fetched within 30 days, name and address match, phone and website match when present |
| Evidence transport | HTTP and HTTPS are both accepted; HTTP rows are labelled |

Anything unknown becomes a human decision. The engine never treats a missing
page, a missing phone or an unclassified category as approval.

A human approval is therefore not a bypass of the risk or rights gates. It
resolves the evidence and classification questions that automation could not.

## Decisions

| Action | Allowed from | Result |
| --- | --- | --- |
| Approve | `needs_human` | Candidate becomes `approved`; an HTTPS evidence URL and the attestation checkbox are required |
| Reject | `needs_human` | Candidate becomes `rejected` |
| Needs info | `needs_human` | Candidate stays `needs_human`; the note is recorded |
| Revoke | `approved` or `auto_approved` | Candidate becomes `revoked` |

Every action inserts a row in `directory_address_review_decision` with the
reviewer's profile ID, the decision, the evidence URL, the note, the checks and
the policy version. Approval is not publication.

### Approval Checklist

1. The source address matches the official page (street, city, state, ZIP).
2. The phone and website on the page match the source when present.
3. The map point is at the business, not a neighboring parcel.
4. The business is not residential, sensitive or adult.
5. The evidence URL is HTTPS, public and specific to the location.
6. The attestation checkbox is ticked.

If the automated evidence is missing or blocked, the official page you supply
becomes the evidence for the human publication path. If the page is generic
(the site root rather than the location page), find the location page first.

### Known Limitations

These limitations remain relevant as of 2026-11-15. Do not treat the current
published set as quality-accepted. Publication applies and evidence writes are
paused in the local operator scripts while the safety and precision gates are
open; evidence dry-runs remain available.

- **Existing publications were not all containment-checked.** The updated
  publisher checks both points against a current verified boundary or a
  separately pinned local Census place candidate, but publication remains
  paused and previously published entries still need review. A point near an
  unverified candidate boundary can be ambiguous. Confirm the address locality
  against the town and leave uncertain cases for review.
- **Published-row revocation requires a matching source key.** The updated
  reviewer action removes reviewed fields and records the decision atomically;
  a key mismatch fails closed. Authenticated browser verification is still
  outstanding. The five documented wrong-town examples were withdrawn locally.
- **Some pilot candidates remain unanchored.** The unique matches were repaired
  with their former keys preserved in audit events; 23 ambiguous or unmatched
  candidates are archived with their prior decisions intact. They remain
  unanchored historical records. Do not invent source identities.
- **The evidence sample is not a quality acceptance.** The two-reviewer
  full-frame quality review was waived for local evaluation only; the 5%
  wrong-town threshold has not been measured over the full frame. Public-release
  quality acceptance remains outstanding.

## Publish Approved Candidates

Publication is currently paused. The command below remains useful as a dry-run;
`--apply` is blocked until the outstanding safety and quality gates are met.

The publisher now requires a live local Gateway containment check for both the
geocoded address and the listing's map point. Set
`DIRECTORY_CONTAINMENT_GATEWAY_URL=http://127.0.0.1:3000` when publication is
eventually enabled. A current verified boundary takes precedence. For local
evaluation only, an unverified Census **place** candidate may be used when no
verified boundary exists, if `DIRECTORY_LOCAL_EVALUATION=true`,
`DIRECTORY_LOCAL_CENSUS_REGIONS_PATH` points to the pinned local manifest, and
`DIRECTORY_LOCAL_CENSUS_REGIONS_SHA256` is set to its approved manifest digest.
The publisher checks its digest and current source/assignment binding and
records the local candidate basis. Missing, stale, mismatched, invalid, or
outside-town evidence fails closed. A candidate boundary is not a verified
boundary, and this configuration does not authorize public release.

```bash
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-publish.cjs \
  --contact-stage "$STAGE" \
  --contact-policy 7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983 \
  --limit 100 \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json
```

The dry-run reports processed rows, resolved active rows, rights-eligible rows
and the first five samples. Do not apply the results while publication is paused.

Publication performs these gates:

1. The candidate is `approved` or `auto_approved`.
2. The candidate risk is explicitly `false` for residential, sensitive and adult.
3. A public-display policy covers the source terms.
4. Exactly one active private row matches the candidate's community, name,
   category and point, and its source key matches the candidate.
5. Evidence is either a fetched official page with name and address matches, or
   a human approval with a matching HTTPS evidence URL.
6. The reviewed fields fit the private sink and the active row.

Only then does it attach `reviewed.address`, `reviewed.website`,
`reviewed.phone` and the evidence URL to the active private row, mark the
candidate `published`, and record the applied decision.

## Evidence Backlog

New candidates start as `needs_human` with `geocode_missing` and
`official_evidence_missing`. Evidence writes are paused; this command only
simulates processing:

```bash
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-evidence.cjs \
  --dry-run \
  --per-town 5 \
  --limit 2000 \
  --census-delay 800 \
  --page-delay 1000 \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json
```

- `--per-town N` selects at most N candidates per town. Without it, `--limit`
  takes the first N rows overall and concentrates on one scan.
- The worker is resumable. Rows that already have both geocode and official
  evidence are skipped unless `--refresh` is set.
- The worker never publishes. Its write mode is currently disabled.
- At 800/1000 ms delays, expect roughly 20 candidates per minute. A full pass
  over the 179k candidate cohort is a multi-day background job.

## Queue Health

Status snapshot:

```bash
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 32768 -U postgres -d ot_directory \
  -c 'SELECT status, count(*) FROM directory_address_review_candidate GROUP BY status ORDER BY count DESC;'
```

Reproducible report:

```bash
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" \
node scripts/local-directory-address-review-queue-report.cjs
```

Per-candidate audit trail:

```bash
PGPASSWORD="$PW" psql -h 127.0.0.1 -p 32768 -U postgres -d ot_directory -c "
SELECT d.\"actorKind\", d.\"actorId\", d.decision, d.\"evidenceUrl\",
       d.reason, d.checks, d.\"policyVersion\", d.\"createdAt\"
FROM directory_address_review_decision d
WHERE d.\"candidateId\"='<candidate-uuid>'
ORDER BY d.\"createdAt\";"
```

## Reviewed Spatial Index

Map (bounds) search reads a candidate index, `directory_reviewed_spatial`: one row per
`active` reviewed binding, written in the same transaction as every binding
transition. It is never authority. Each request re-checks the live binding, lease,
policy, revocations, content digest and assignment, so a stale or extra row cannot
disclose a location and a missing row only hides one.

Readiness is fail-closed. Bounds requests answer 503 until a rebuild has completed
for the current validator version and no active, current-lease binding lacks a row.
Plain listings, detail and identity routes are unaffected, and overall readiness is
not failed by it. `GET /health/ready` reports it (cached 30 s):

```json
"reviewedSpatial": { "ready": true, "missing": 0, "validatorVersion": 1, "rebuildCompletedAt": "..." }
```

After deploying the migration, and after any validator version bump, run the
reconcile command. It is a read-only check by default:

```bash
export DIRECTORY_DATABASE_URL="$LIVE"   # the live Directory database
export TS_NODE_PROJECT=apps/directory/tsconfig.json
node -r ts-node/register/transpile-only scripts/local-directory-reviewed-spatial-reconcile.cjs --check
node -r ts-node/register/transpile-only scripts/local-directory-reviewed-spatial-reconcile.cjs \
  --apply --confirm-database ot_directory
```

`--check` prints `missing`, `stale`, `orphaned`, `versionMismatch` and
`unreachableAssignment` (active bindings whose listing has no assignment token
matching the binding; reported, never repaired). `--apply` clears
`rebuildCompletedAt`, projects every active binding that lacks a current row (500 per
transaction, `FOR UPDATE SKIP LOCKED`, retried up to five passes), deletes rows with
no active binding or no live row, then records the counts and `rebuildCompletedAt`.
If any binding stayed locked or could not be projected it exits 2 and leaves the index
not ready; rerun it. It never changes a binding, a listing, a lease or an assignment
token, and never creates rows for non-active bindings. `--apply` refuses to run unless
`--confirm-database` equals the database name in `DIRECTORY_DATABASE_URL`.

## Blocked Queue Meanings

| Reason | What it means | How to unblock |
| --- | --- | --- |
| `official_evidence_unavailable` | The page was blocked, unavailable or absent | Supply an HTTPS location page and approve |
| `official_address_mismatch` | The page was fetched but did not contain the address | Find the location page or confirm the source address |
| `official_phone_mismatch` | The page did not contain the source phone | Confirm the phone on the page or reject the phone |
| `official_name_mismatch` | The page did not contain the business name | Check for a rebrand or a wrong website |
| `multiple_addresses` | More than one source address | Choose the primary address |
| `point_distance_requires_review` | Geocode is plausible but too far from the source point | Check the map |
| `residential_classification_unknown` | Category outside the safe commercial list | Classify as non-residential or reject |
| `sensitive_classification_unknown` / `adult_classification_unknown` | The classifier could not clear the item | Review manually; these never auto-approve |
| `geocode_no_match` / `geocode_ambiguous` / `geocode_error` | Census could not return exactly one match | Correct the address or reject |
| `rights_review_required` / `rights_denied` | The policy does not cover the source terms | Rights decision; not a reviewer task |
| `geocode_missing` / `official_evidence_missing` | The evidence worker has not run | Run the evidence worker |

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `403 Owner Console scope required` | Request came from outside the Owner Console |
| `403 Verified reviewer required` | The session has no valid profile UUID |
| `503 Address review unavailable` | Gateway or Directory is missing `DIRECTORY_LOCAL_EVALUATION`, the internal URL or the local secret |
| `Candidate unavailable` | The candidate UUID does not belong to the town in the URL |
| `Invalid decision for current candidate status` | Approve/reject/needs-info only from `needs_human`; revoke only from `approved` or `auto_approved` |
| `Approval requires an HTTPS evidence URL` | Enter a public HTTPS page, not an HTTP URL or a local address |
| `Matching official-page evidence is required` | Automated evidence is missing and there is no human approval to fall back on |
| `Human approval evidence is required` | The publishing actor is not the approver, or the evidence URL differs from the recorded approval |
| `No active private row matches this candidate` | Name, category or point changed; check the source row and whitespace |
| Published but no address on the public page | Check `listing.reviewed` on the active row and that the evidence URL scheme is accepted |

## Safety Rules

- Never approve without comparing the source record, map point and evidence.
- Never approve a residential, sensitive or adult location.
- Do not paste evidence URLs that contain credentials, tokens or query strings
  that identify a person.
- Publication is local-evaluation only. Export is disabled and production
  release still requires the S9 gates.
- The queue and evidence are private. Do not copy candidate data into public
  issues, chats or marketing material.

## Related Docs

- [S7 address review and auto-approval](../plans/town-square-directory/S7-address-review-auto-approval.md)
- [S4a2 private extraction evidence](../plans/town-square-directory/S4a2-private-extraction-evidence.md)
- [Local evaluation review](../plans/town-square-directory/LOCAL-EVALUATION-REVIEW-2026-11-08.md)
- [Runbooks](./runbooks.md)
- [Local Stack Operations](./local-stack.md)
- [Troubleshooting](./troubleshooting.md)
