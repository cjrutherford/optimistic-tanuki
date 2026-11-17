# S7 address review and auto-approval

**Status:** Implemented local-evaluation slice. Public display is approved for all active towns; export remains disabled and production release still requires the S9 gates. Operator procedure: [Directory Address Review](../../operators/directory-address-review.md). Current handoff: [HANDOFF-2026-11-11-address-review.md](./HANDOFF-2026-11-11-address-review.md).

## 1. Goal

Automate the mechanical part of address verification and allow a narrowly bounded auto-approval tier. Every automatic approval must be:

- backed by an approved source/field rights decision;
- backed by independent address evidence;
- non-residential, non-sensitive and non-adult;
- auditable and reversible;
- reversible when the source policy or evidence changes.

Ambiguous, conflicting, high-risk or unsupported cases go to a human review queue. They are never auto-published.

## 2. Current state

The active directory row stores only the public-safe projection: name, category, point, attribution, notices and terms. It does **not** retain source `addresses`, `websites` or `phones` for most rows.

The only reviewed-field writer is `OverturePrivateSink.attachLocalReviewedFields` in `apps/directory/src/overture-private-sink.ts`. It requires:

- the original source row (including `addresses`, `websites`, `phones`);
- a source/field rights policy;
- an HTTPS evidence URL;
- explicit `nonResidential`, `nonSensitive`, `nonAdult` attestations;
- explicit `addressVerified` (and optionally `websiteVerified`, `phoneVerified`).

The helper verifies that the source row still matches the stored name, category and point, then writes a `reviewed` object onto the private row. The runtime exposes the reviewed address only when `reviewed.evidenceUrl` is a valid HTTP or HTTPS URL and the reviewed arrays are valid. The gateway adds `coordinates` only when the listing has an address.

The gateway now exposes the owner-console queue at
`GET/POST /directory/towns/:townId/address-review-candidates` and the Owner
Console renders it at `/dashboard/directory-address-review/:communityId`. The
queue supports approve, reject, needs-info and revoke decisions, and publication
is a separate policy-gated script step. See the
[operator runbook](../../operators/directory-address-review.md).

## 3. Data prerequisite

Automation needs the source contact fields. They were not in the active private
row for the October cohort and were not in the October/census stage databases.

**Resolved 2026-11-11:** `scripts/local-directory-overture-contact-capture.cjs`
re-read the four assets that cover all 133 towns and retained composed
addresses, websites, phones and minimal provenance. The seed matched 181,475
active rows and created 179,125 candidates. See
[Full 133-town cohort](#full-133-town-cohort--contact-re-capture-and-seeding-2026-11-10).

The retained September artifact remains usable for the four pilot towns:

- `four-seat-places.jsonl`
- 20,811 rows
- 20,811 with addresses
- 14,855 with websites
- 18,570 with phones

The October cohort for the additional 133 towns must either be re-acquired or imported through a stage that retains candidate addresses, websites and phones in a private review table. Until that exists, automation can only cover the September four-town artifact for real data.

## 4. Two-key model

Auto-approval cannot override a missing rights decision.

1. **Rights key** — the source and the address field must be approved for public display, using the existing field-rights evaluator. If the rights decision is `review` or `denied`, the candidate cannot be auto-approved.
2. **Evidence key** — the candidate must pass independent address verification and risk checks. This is the part the automation can decide.

A human reviewer can record an approval only for a candidate whose rights key is eligible. A human cannot manufacture missing upstream rights.

## 5. Candidate model

A review candidate contains:

- source identity: release, scan ID, row number;
- source name, category, taxonomy;
- source point;
- source addresses, websites and phones;
- rights decision for the address field;
- automated geocode evidence;
- automated official-page evidence;
- risk flags: residential, sensitive, adult;
- ambiguity flags: multiple addresses, conflicting contacts, low-precision geocode.

Evidence records carry provider, timestamp, evidence URL/hash and the fields checked.

## 6. Decision rules

### Reject (no address publication)

- no source address;
- invalid or empty address;
- address rights denied;
- adult-oriented record;
- known sensitive location;
- geocoder returns no match;
- point-to-address distance beyond the hard maximum;
- explicit conflict between authoritative evidence and the source.

### Needs human

- multiple addresses;
- geocoder ambiguous, low precision, error or timeout;
- point-to-address distance above the auto limit but within the hard limit;
- no official evidence, blocked fetch, or evidence unavailable;
- name, address, phone or website mismatch;
- residential unknown or possible;
- sensitive/adult classification uncertain;
- missing source point;
- rights decision requires review;
- conflicting source fields.

### Auto-approve

All of the following must be true:

- exactly one valid source address;
- address rights are eligible for public display;
- geocoder returns one high-precision match;
- point-to-address distance is within the precision-specific auto limit;
- official evidence was fetched and matches name and address;
- phone/website, when present, match or are explicitly omitted;
- residential, sensitive and adult checks all pass;
- no ambiguity or conflict flags;
- the decision policy version and thresholds are recorded.

### Proposed thresholds

These are proposed and require approval before any auto-approval runs.

| Check                         |   Auto limit |       Human limit |
| ----------------------------- | -----------: | ----------------: |
| Rooftop geocode distance      |        150 m |           2,000 m |
| Street/range geocode distance |      1,000 m |           2,000 m |
| Locality-only geocode         | not eligible |             human |
| Name similarity               |          0.8 | below 0.8 → human |
| Official evidence age         |      30 days |     older → human |
| Re-verification interval      |      90 days |     stale → human |

The Census Geocoder is address-range, not rooftop. A street/range match can legitimately be hundreds of metres from the source point. The auto limit must therefore depend on precision, not a single global distance.

## 7. Human-in-the-loop queue

Statuses:

- `candidate`
- `auto_approved`
- `needs_human`
- `rejected`
- `revoked`

The queue page shows:

- source name, category, point and address;
- source website and phone;
- rights decision;
- geocode result and distance;
- official evidence link and extracted matches;
- automated verdict and reasons;
- reviewer approve/reject/needs-more-information controls;
- evidence URL and reviewer attestation.

Auto-approved rows remain visible in the audit queue. A human can revoke an auto-approval or mark the evidence stale.

## 8. Audit and withdrawal

Every decision stores:

- candidate identity;
- automated checks and verdict;
- policy version and thresholds;
- evidence URL and hash;
- reviewer identity for human decisions;
- timestamps;
- downstream listing ID and applied reviewed fields.

Withdrawal behavior:

- policy withdrawal removes the reviewed fields and coordinates through the existing private-policy withdrawal path;
- evidence expiry or address change moves the candidate out of `auto_approved`;
- a human revocation removes the reviewed fields and records the reason.

## 9. Implementation slices

1. **Decision engine and dry-run triage** — pure decision logic, tests, September artifact triage. No database writes, no public publication.
2. **Candidate and decision persistence** — private review tables, import from the September artifact, audit records.
3. **Gateway and owner-console queue** — list candidates, inspect evidence, approve/reject.
4. **Evidence providers** — Census Geocoder, official-page fetch with ToS/robots controls, caching and rate limits.
5. **Auto-approval pilot** — measure precision on the four-town cohort, then enable the high-confidence tier.
6. **October retention and scale** — retain candidate contact fields for the additional towns, or re-acquire the October source.

## 10. First-slice evidence (2026-11-10)

The first slice is implemented as pure decision logic plus a read-only readiness report. It does not write to the database or publish anything.

- `apps/directory/src/address-review.ts` — decision engine.
- `apps/directory/test/address-review.test.js` — 16 passing cases covering auto-approve, needs-human and reject paths.
- `scripts/local-directory-address-review.mjs` — read-only readiness report for the September artifact.
- Nx targets: `directory:test-address-review` and `directory:review-address-readiness`.

Readiness on the retained September artifact (`four-seat-places.jsonl`):

- 20,811 rows
- 19,976 with a usable address, all single-address
- 14,521 with a website
- 18,548 with a phone
- 13,510 with address, website and phone

The top categories include places of worship, restaurants, financial services, home services, personal/beauty services, automotive services, hardware, fashion and real estate. Several of those are high-risk or potentially residential and must not be auto-approved without classification.

Real sample, Walmart Garden Center in Valdosta:

- Census Geocoder normalized `340 Norman Dr, Valdosta, GA 31601` to `340 NORMAN DR, VALDOSTA, GA, 31601`.
- The match was address-range precision and 719 m from the source point, which is inside the proposed 1,000 m range threshold.
- The official Walmart store page returned a bot challenge, so the evidence fetch was classified `blocked`.
- With public-display rights marked `review`, the engine returned `needs_human` for `rights_review_required` and `official_evidence_unavailable`.
- With public-display rights marked `eligible` and synthetic matching evidence, the engine returned `auto_approve`.

This confirms the decision logic works. The remaining real-world blockers are the missing public-display rights approval and evidence sources that can be fetched reliably. Sites with bot protection require human review or a separately approved provider.

### Persistence slice

Private review persistence is implemented but not applied to the live Directory database:

- Entities: `directory_address_review_candidate` and `directory_address_review_decision`.
- Migration: `1794335354004-DirectoryFoundation.ts`, generated through the Directory Nx target and run on a disposable PostGIS database. Unrelated generated default churn was removed.
- Store: `apps/directory/src/address-review-store.ts` for candidate upsert, queue listing, and human decisions.
- Import: `scripts/local-directory-address-review-import.cjs`, which requires `DIRECTORY_REVIEW_DATABASE_URL` and never writes to `DIRECTORY_DATABASE_URL`.
- Nx targets: `directory:test-address-review-store`, `directory:review-address-import`.

A dry import of five September rows into `directory_address_review_dev` stored five `needs_human` candidates and five audit decisions. Reasons were `rights_review_required`, `adult_classification_unknown`, `sensitive_classification_unknown`, `residential_classification_unknown`, `geocode_missing` and `official_evidence_missing`. No live rows, public projections or map coordinates changed.

### Queue slice

The private queue is now wired through Directory, the gateway and the owner console:

- Directory internal routes:
  - `GET /internal/local-evaluation/towns/:town/address-review-candidates`
  - `POST /internal/local-evaluation/towns/:town/address-review-candidates/:candidateId/decisions`
- Gateway routes:
  - `GET /directory/towns/:town/address-review-candidates`
  - `POST /directory/towns/:town/address-review-candidates/:candidateId/decisions`
- Owner-console page:
  - `/dashboard/directory-address-review/:communityId`
  - linked from community operations as **Review Addresses**
- The gateway requires `AuthGuard`, owner-console scope and a verified reviewer profile. The local slice reuses `DIRECTORY_LOCAL_EVALUATION_SECRET`; a separate address-review secret is required before production.
- The additive migration was applied to the local `ot_directory` database. The review tables remain private and are not served by public routes.
- The import seeded **22** Valdosta candidates into the live local review queue; all are `needs_human` with the expected review reasons.
- Internal list and human decision calls were verified against the live local Directory service; the live internal list returned 22 Valdosta candidates.
- The gateway route is registered and returns `401 Unauthorized` without a session credential.
- Human decisions are guarded by candidate status: approval/rejection/needs-info only from `needs_human`, revocation only from `approved` or `auto_approved`.
- Gateway controller tests: 5 passed.
- Owner-console component tests: 3 passed.
- Directory, gateway and owner-console images were rebuilt and restarted.
- The owner-console route is client-rendered like the other review pages.
- No listing was published and no map coordinate was changed.
- Not run: authenticated browser proof of the owner-console page; no reviewer session was available in this run.

The queue API and page are now in place.

### Evidence-provider slice

- `apps/directory/src/address-evidence.ts` implements:
  - US Census oneline-address geocoding, including no-match, ambiguous and error results;
  - HTTPS official-page fetching with robots.txt checks, rate limiting, timeouts and a 512 KiB body cap;
  - bot/challenge detection;
  - JSON-LD and text extraction for name, address, phone and website matching;
  - SHA-256 evidence hashing;
  - a simple rate limiter.
- `apps/directory/test/address-evidence.test.js` — 9 passing cases.
- `updateAddressReviewEvidence` persists geocode/official evidence, re-evaluates the verdict and records a new automated decision only when the verdict/status changes.
- `scripts/local-directory-address-review-evidence.cjs` processes the private queue with configurable delays, an optional `--id`, `--refresh`, `--dry-run` and `--no-official`.
- Nx targets: `directory:test-address-evidence` and `directory:review-address-evidence`.

Live local evidence run:

- The first 10 Valdosta-seat candidates were processed. Nine geocoded successfully; one was 1,222 m from its source point and therefore needs human review.
- Their source websites were HTTP or absent, so no HTTPS official-page fetch ran. Those candidates remain `needs_human` with `official_evidence_unavailable`.
- Two early candidates geocoded at 198 m and 224 m from their source points.
- A synthetic Walmart candidate geocoded at 719 m; the official page was classified `blocked` by the bot challenge. The verdict remained `needs_human` with `official_evidence_unavailable`.
- The script reuses stored geocode/official evidence and marks no-HTTPS cases as unavailable so they are not retried on every run.
- No listing was published and no public map coordinate was changed.

The source artifact contains many `http://` websites. Those are intentionally not fetched as official evidence under the current HTTPS-only policy. They remain human-review cases unless a separately approved HTTP evidence policy exists.

### Publication wiring

- `apps/directory/src/address-review-publish.ts` resolves the active private row for an approved candidate and calls `OverturePrivateSink.attachLocalReviewedFields` with an explicit public-display policy.
- Publication requires:
  - candidate status `approved` or `auto_approved`;
  - matching official evidence (`fetched`, name and address match);
  - explicit clear residential/sensitive/adult risk;
  - a matching active private row;
  - an explicit runtime `OvertureRightsPolicy` with `publicDisplay: true`;
  - a verified publisher UUID.
- `apps/directory/test/address-review-publish.postgres.test.js` — 3 passing cases, including a full reviewed-field attachment on a disposable private row.
- `scripts/local-directory-address-review-publish.cjs` is dry-run by default and requires `--apply --policy <runtime-policy.json>` to publish.
- Nx targets: `directory:test-address-review-publish` and `directory:review-address-publish`.

Publication is policy-gated. No live row was published because no approved public-display policy was supplied and no candidate is in `approved`/`auto_approved` state.

### Auto-approval pilot report

Live queue state after the evidence pass:

- 22 candidates
- 20 `needs_human`
- 2 `rejected`
- 0 `auto_approved`
- 0 `approved`
- 0 `published`

Reason counts:

- 22 `rights_review_required`
- 22 `residential_classification_unknown`
- 22 `adult_classification_unknown`
- 22 `sensitive_classification_unknown`
- 12 `geocode_missing`
- 12 `official_evidence_missing`
- 10 `official_evidence_unavailable`
- 1 `geocode_no_match`
- 1 `point_too_far`
- 1 `point_distance_requires_review`

### Approved rights and active-cohort pilot — 2026-11-10

The repository owner approved public display for the address, website and phone fields across **all active Town Square directory towns**. The approval records are:

- `policies/overture-public-display-2026-09-23.json`
- `policies/overture-public-display-2026-10-21.json`

Both policies leave export disabled and are marked local-evaluation only. The September policy is what the current active pilot uses.

Implemented follow-ups:

- Rule-based risk classifier: `apps/directory/src/address-risk.ts`, with 5 passing tests. It clears only the existing low-risk commercial categories; unknown categories and possible residential units go to a human.
- Bounded HTTP evidence: the official-page fetcher now accepts HTTP and HTTPS, still applying robots checks, rate limits, timeouts, body limits and bot detection. HTTP evidence is labelled in the owner console.
- Active-seed bridge: `scripts/local-directory-address-review-active-seed.cjs` matched **104** active October rows in the four pilot towns to retained September contact records and seeded **100** review candidates.
- Evidence run: **100** active candidates processed.
  - **71** geocode matches
  - **25** official pages fetched
  - **27** blocked
  - **48** unavailable
  - **3** auto-approved and published
  - **63** sent to human review
  - **34** rejected
- Published through the private sink and verified in the public gateway:
  - **Advance Auto Parts** — 512 E Screven St
  - **Food Lion** — 1207 W. Screven St.
  - **Western Motel of Quitman** — 1603 W Screven St
- The Valdosta public directory now returns **4** reviewed locations with coordinates, including the existing Walmart Garden Center. The directory map displays all four.
- A second publication dry-run returns zero remaining approved candidates, as expected.

The active pilot therefore produced a **3% auto-approval rate** on the seeded active sample, with all three auto-approved rows published. The remaining active candidates are human review or reject outcomes. The other 133 towns previously required the October contact-field re-acquisition; that re-acquisition is now complete (see the full 133-town section below).

The original September-artifact queue (22 candidates) still produced **zero auto-approvals**. The engine and publisher are working; those gates are not satisfied:

1. **Rights:** the active source policy is private-display only. There is no approved public-display policy for the address field.
2. **Risk:** residential/sensitive/adult classification is still unknown for every candidate; the engine correctly refuses to auto-approve.
3. **Evidence:** most source websites are HTTP or absent; the HTTPS-only provider marks them unavailable. Walmart and similar sites also block automated fetches.
4. **Active cohort:** the imported candidates came from the September artifact. Publication resolves the active private row by name/category/point; the wiring test proves attachment, but the live queue has no approved candidate to publish.

### Full 133-town cohort — contact re-capture and seeding (2026-11-10)

The active 133-town cohort has **182,277** private rows across **133 towns**, but the October projection retained only name, category, location, attribution, notices and terms. It did not retain addresses, websites or phones. That is why the first pilot could only seed the four towns with a retained September artifact.

Four of the sixteen October assets cover every town in the cohort:

| Asset   |   Size |
| ------- | -----: |
| `00000` | 696 MB |
| `00001` | 773 MB |
| `00003` | 788 MB |
| `00006` | 721 MB |

`scripts/local-directory-overture-contact-capture.cjs` re-reads those pinned assets with the same region manifest and the same `(regionId, sourceFileRowNumber)` numbering, but retains:

- `addresses` composed from `freeform`, `locality`, `region` and `postcode`;
- `websites` and `phones`;
- minimal source provenance (`dataset`, `license`, `property`).

The shared sink drops these fields unless constructed with `includeContactFields` / `includeSourceProvenance`, so ordinary captures still store only the approved private projection.

`scripts/local-directory-address-review-active-seed.cjs --contact-stage ... --contact-policy ... --active-policy ...` matches active rows by `(regionId, sourceFileRowNumber)` and skips existing review items by community/name/category/point. The point dedupe prevents the September pilot scan from creating a second queue item for the same business.

```bash
export PW=$(docker exec town-square-directory-db sh -lc 'echo "$POSTGRES_PASSWORD"')
export STAGE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory_census_stage"
export LIVE="postgres://postgres:${PW}@127.0.0.1:32768/ot_directory"

# 1. Contact capture (one process per asset for overlap)
DIRECTORY_LOCAL_EVALUATION=true \
LOCAL_STAGE_DATABASE_URL="$STAGE" LOCAL_DIRECTORY_DATABASE_URL="$LIVE" \
TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-overture-contact-capture.cjs --asset 00000,00001,00003,00006

# 2. Seed every active row that has contacts
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-active-seed.cjs \
  --contact-stage "$STAGE" \
  --contact-policy 7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983 \
  --active-policy 66372b1d63cc9db88f91733a9d593cbfc3f60a0b4a38d1655e0deecf1df7f78b \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json \
  --limit 250000

# 3. Evidence sample across towns
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-evidence.cjs \
  --per-town 5 --limit 2000 --census-delay 800 --page-delay 1000 \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json

# 4. Publish approved candidates
DIRECTORY_REVIEW_DATABASE_URL="$LIVE" TS_NODE_PROJECT=apps/directory/tsconfig.json \
node -r ts-node/register/transpile-only \
  scripts/local-directory-address-review-publish.cjs \
  --contact-stage "$STAGE" \
  --contact-policy 7dd1e46f51d7812c3abefcbee6cc57d2eefa7d77c4349b364d10c6464fca7983 \
  --apply \
  --policy docs/plans/town-square-directory/policies/overture-public-display-2026-10-21.json \
  --reviewer <reviewer-uuid>
```

Human approval can publish without automated official-page evidence: `publishAddressReviewCandidate` accepts `humanEvidenceUrl` only when the same actor recorded an `approve` decision with that HTTPS URL. The policy, active-row, evidence-URL and risk gates still apply.

#### Capture and seed results (2026-11-11)

| Step                                                     |  Result |
| -------------------------------------------------------- | ------: |
| Active private rows                                      | 182,277 |
| Contact rows with an address                             | 179,394 |
| Active rows matched by `(regionId, sourceFileRowNumber)` | 181,475 |
| New review candidates                                    | 179,125 |
| Towns seeded                                             |     133 |
| Active rows with no contact record                       |     802 |
| Active rows with contacts but no address                 |   2,346 |
| Duplicate business identities skipped                    |       4 |
| Total queue after seeding                                | 179,247 |

The 802 no-contact rows and 2,346 no-address rows are the residual mismatch between the original eligible capture and the contact-retaining pass. They stay out of the queue rather than being guessed.

#### Evidence sample results (2026-11-11)

The evidence worker ran with `--per-town 5`, which selects at most five candidates per town instead of the first N overall. The processed cohort is **785** candidates (663 from this pass plus the earlier pilot rows).

| Outcome                   | Count |
| ------------------------- | ----: |
| Published (auto-approved) |    53 |
| Rejected                  |   172 |
| Needs human               |   560 |

| Evidence step             | Count |
| ------------------------- | ----: |
| Geocode match             |   637 |
| Official page fetched     |   217 |
| Official page blocked     |   276 |
| Official page unavailable |   292 |

Blocked reasons across the 560 processed human-review candidates:

| Reason                               | Count |
| ------------------------------------ | ----: |
| `official_evidence_unavailable`      |   442 |
| `official_address_mismatch`          |   107 |
| `official_phone_mismatch`            |   103 |
| `official_name_mismatch`             |    36 |
| `point_distance_requires_review`     |    20 |
| `residential_classification_unknown` |    19 |
| `geocode_ambiguous`                  |     7 |
| `official_website_mismatch`          |     3 |
| `geocode_error`                      |     1 |

Geocoding is not the bottleneck: 637 of 785 processed candidates matched, and 491 of the 499 sampled human-review rows had a geocode match. The bottleneck is the official page. **442** human-review rows had a blocked or unavailable page, and of the 101 fetched pages only 8 carried both a matching name and address. Most fetched URLs were generic site roots that do not publish the location address.

The remaining **178,462** `needs_human` rows have not been through the evidence worker. At the observed rate (roughly 660 rows in 33 minutes with 800/1000 ms delays), a full pass takes several days. The worker is resumable, and `--per-town` or the delays can be adjusted for a larger sample.

#### Blocked-queue taxonomy

`needs_human` is not one failure. The decision engine records every failed or unknown check as a reason:

| Reason                                                                                                           | Meaning                                                                  | What unblocks it                                                 |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `official_evidence_unavailable`                                                                                  | The official page was blocked, unavailable or absent.                    | A human supplies an HTTPS record, or the site becomes fetchable. |
| `official_name_mismatch` / `official_address_mismatch` / `official_phone_mismatch` / `official_website_mismatch` | The page was fetched but a compared field did not appear.                | Human review; a better canonical page.                           |
| `multiple_addresses`                                                                                             | The source row has more than one address, so `singleAddress` is unknown. | A human picks the primary address.                               |
| `residential_classification_unknown`                                                                             | The category is not in the low-risk commercial allowlist.                | Human classification.                                            |
| `sensitive_classification_unknown` / `adult_classification_unknown`                                              | The rule classifier could not clear the item.                            | Human classification; these never auto-approve.                  |
| `geocode_no_match` / `geocode_ambiguous` / `geocode_error`                                                       | Census could not return exactly one match.                               | A corrected address or a human check.                            |
| `point_distance_requires_review` / `point_too_far`                                                               | The geocode is plausible but exceeds the distance threshold.             | Human check of the map point.                                    |
| `rights_review_required` / `rights_denied`                                                                       | The public-display policy does not cover the source terms.               | A rights decision; not a reviewer task.                          |
| `geocode_missing` / `official_evidence_missing`                                                                  | The candidate has not been through the evidence worker yet.              | Run the evidence worker.                                         |

`rejected` means a hard failure (no geocode match, invalid address, adult/sensitive/residential true, rights denied), not a parked item.

## 11. Scope and audit findings — 2026-11-11

The local-evaluation expansion is recorded in
`LOCAL-EVALUATION-REVIEW-2026-11-08.md`: the 133-town append, unverified
assignments, October staging and local display exception were already approved.
The contact re-capture is slice 6 of this plan. The findings below are about the
publication and audit gates that the thread ran ahead of.

| Severity | Finding                                                                                                                                                                                                          | Evidence                                                                                                                                                                    | Status                                                      |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| P0       | 120 pilot/import candidates are not bound to an active private row. The September import uses a synthetic scan ID; the artifact-mode seed stores the artifact row number with an active scan ID.                 | `scripts/local-directory-address-review-import.cjs`; `scripts/local-directory-address-review-active-seed.cjs`; 120 candidates fail the `(scanId, sourceFileRowNumber)` join | Open                                                        |
| P0       | Publication resolves the active row by name/category/point and does not require the candidate's source key to match. This masks the P0 above and lets a candidate publish a different row than its audit record. | `apps/directory/src/address-review-publish.ts`                                                                                                                              | Open                                                        |
| P0       | No town-containment gate. The engine compares the geocode to the source point, not the assigned town boundary. Published examples: Valdosta → Quitman (3), Greer → Taylors, Kill Devil Hills → Nags Head.        | Published rows; `DEFAULT_ADDRESS_REVIEW_POLICY`                                                                                                                             | Open                                                        |
| P1       | Auto-approval was enabled at 133-town scale before the four-town precision measurement required by slice 5.                                                                                                      | §9 item 5; 663-row sample                                                                                                                                                   | Open; local display exception applies, precision unmeasured |
| P1       | Published rows cannot be retracted from the owner console. `revoke` only works from `approved`/`auto_approved`.                                                                                                  | `directory-address-review-page.component.ts`                                                                                                                                | Open                                                        |
| P1       | The 2026-11-10/11 decisions (all-town public display, bounded HTTP evidence, human-evidence publication, contact retention) are not in `DECISIONS-2026-11-07.md` or an ADR.                                      | `DECISIONS-2026-11-07.md`; policy `approvedBy: chat approval`                                                                                                               | Open                                                        |
| P2       | The public-display policy grants all nine fields, while the approval notes name address, website and phone. `primary`/`hierarchy` are required by the projection but are not served; `alternate` is optional.    | `policies/overture-public-display-*.json`                                                                                                                                   | Open                                                        |
| P2       | Contact and provenance retention was added to the shared private sink as an opt-in. The default still drops them, but the documented "never arbitrary source data" guarantee now depends on the caller.          | `overture-private-sink.ts`                                                                                                                                                  | Open                                                        |

The wrong-town examples are a product defect even under the unverified-assignment
exception: the address itself is visible and contradicts the town page. Do not
treat the 50 auto-published rows as a precision or quality acceptance.

On 2026-11-11 the user chose **document only for this thread**: no rollback or
data changes now, and the next agent is expected to implement the corrections
above in place, preserving the existing queue and publications. This section is
the audit record, not a claim that the findings were fixed.

## 12. Open decisions

- Approve the auto-approval policy and thresholds.
- Approve the evidence sources and their terms of use.
- Confirm who holds the reviewer role.
- Confirm the re-verification cadence and evidence retention.
- Confirm whether the address auto-approval policy applies to the whole active cohort or only the reviewed sample until more evidence is processed.

### 2026-11-15 continuation

The five known wrong-town reviewed objects were withdrawn in one local audited
transaction, and bounded Gateway searches around their former locations returned
no matching pins. Three candidate keys were repaired as part of that correction;
94 further uniquely matched candidates were re-keyed with their old keys in
system audit events. Twenty-three candidates remain unanchored (21 without an
exact active match and two competing for one target), so source identity remains
open. These changes do not establish full-frame precision.

Published-candidate revocation now removes the reviewed object and records the
reviewer decision in one transaction when the candidate key and row identity
match. Publication now writes reviewed fields, status and audit event in one
transaction; a database failure-injection test verifies rollback. Evidence
refresh and re-seeding cannot overwrite a previously reviewed or terminal
candidate. Automatic approval is held for human review at the store boundary,
and local evidence writes and publication applies remain paused. The town
containment gate, the two-reviewer quality and precision work, and authenticated
browser verification are still outstanding. These are local evaluation changes,
not production approval.

The user subsequently authorized archiving the 23 unresolved candidates while
retaining their audit history. A local transaction marked all 23 `archived`,
retained their 27 prior decisions, and added an archive event for each. The
candidates remain unanchored historical records, not resolved source identities;
there are no unanchored candidates in active statuses. The user also waived the
independent two-reviewer full-frame gate for local evaluation only. This waiver
is not a quality pass or public-release approval and does not remove the separate
containment, precision, rights or withdrawal requirements.

The publisher now has a containment gate for future publication: it checks the
address geocode and the source map point against a current verified boundary,
rechecks and locks the matching reviewed geometry through the write, and falls
back only in local evaluation to an explicitly pinned, current Census place
candidate. It records which basis was used. A modified-boundary race, missing or
stale candidate and points outside the boundary were tested against PostgreSQL
with mocked Gateway responses. A rollback-only exercise also used the live
Gateway and local manifest for five inside candidates. There are currently no
live verified boundaries, and previously published rows were not all validated
by this new path. One of 42 publications examined against candidate places had
a geocode six metres outside an unverified boundary while its source point was
inside; it remains an ambiguous review item. Publication remains paused.
