# S5 public directory API: response and error examples

Captured 2026-11-17 from the local stack (S5 build) with read-only GET requests to the gateway at `127.0.0.1:3000`. Base path: `/api/directory/towns/:townId`. No credentials were sent. `$T` below is town `615482e8-d72b-4500-989f-5b79ceb32781`. Listing arrays are cut to 2 of 25 entries, and `reference` and `nextCursor` values are cut to 24 characters followed by `…` (real values are about 300 characters of base64url). Business names are public Overture data and are left as served.

Contract compatibility is pinned by `apps/gateway/src/controllers/directory/directory.contract.spec.ts` against `__fixtures__/local-directory-page.golden.json`, which is type-checked against `LocalDirectoryCursorPage` in `libs/social/contracts/src/lib/directory.ts`. See also [S5-public-contract.md](S5-public-contract.md).

Every handler on these routes sets `Cache-Control: no-store` (checked by `directory.no-store.spec.ts`). Cached copies are never reused, so there is nothing to vary or invalidate.

## Captured live

### 1. Cursor page, first page (200)

`GET /api/directory/towns/$T/local-evaluation-listings?pagination=cursor`

Headers that matter: `Cache-Control: no-store`, `Content-Type: application/json; charset=utf-8`.

```json
{
  "listings": [
    {
      "name": "PINEVIEW GROCERY",
      "category": "convenience_store",
      "attribution": ["meta; Overture Maps Foundation (October 2026)"],
      "notices": ["CDLA Permissive 2.0"],
      "termsUrls": ["https://cdla.dev/permissive-2.0/"],
      "id": "40cbfc65-82ad-467c-aae4-342bde4c3164",
      "reference": "_v9U5Zk8ENGntWkZSS7vbY7P…"
    },
    {
      "name": "Hunt Brothers Pizza",
      "category": "restaurant",
      "attribution": ["Microsoft; Overture Maps Foundation (October 2026)"],
      "notices": ["CDLA Permissive 2.0"],
      "termsUrls": ["https://cdla.dev/permissive-2.0/"],
      "id": "fb766500-36db-4e03-a5f1-06df66fc1941",
      "reference": "S3SB8QL884EtGwynJ0gvTdLd…"
    }
  ],
  "hasMore": true,
  "nextCursor": "k96s1ZHWeciE8cNRYpgmP3uu…",
  "sourceFreshness": {
    "state": "unknown",
    "releaseId": null,
    "sourcePublishedAt": null,
    "acquiredAt": null,
    "thresholds": { "freshDays": 90, "staleDays": 120 }
  },
  "coverage": { "state": "available", "withheldReviewedDetails": 1 },
  "policyVersion": "574205e24da3cddc"
}
```

This page held 25 listings. None of the 25 carried address, phone, website or coordinates (only reviewed rows can), and `withheldReviewedDetails` was 1. `sourceFreshness.state` is `unknown` with null dates on this stack.

### 2. Cursor page, next page (200)

`GET .../local-evaluation-listings?pagination=cursor&cursor=<nextCursor from 1>`

Same headers and top-level keys. Listings are different rows (`Swagg Seven`, `Sly Fox Pickins`, then 23 more), `hasMore` is `true`, and `nextCursor` is a new value (`Kejor2Jo5vW5ub0RpstzwCFq…`). The last page returns `hasMore: false, nextCursor: null`.

### 3. Detail by reference (200)

`GET .../local-evaluation-listings/<reference from 1>`

```json
{
  "name": "PINEVIEW GROCERY",
  "category": "convenience_store",
  "attribution": ["meta; Overture Maps Foundation (October 2026)"],
  "notices": ["CDLA Permissive 2.0"],
  "termsUrls": ["https://cdla.dev/permissive-2.0/"]
}
```

The detail body has no `id` or `reference` and no coverage/freshness fields. A reference is short-lived and row-keyed; the stable `id` comes from the page.

### 4. Bounds query (200, empty page)

`GET .../local-evaluation-listings?pagination=cursor&bounds=-122.5,37.7,-122.3,37.8`

```json
{
  "listings": [],
  "hasMore": false,
  "nextCursor": null,
  "sourceFreshness": { "state": "unknown", "releaseId": null, "sourcePublishedAt": null, "acquiredAt": null, "thresholds": { "freshDays": 90, "staleDays": 120 } },
  "coverage": { "state": "available", "withheldReviewedDetails": 1 },
  "policyVersion": "574205e24da3cddc"
}
```

`bounds` is `west,south,east,north` in WGS84, cursor mode only, at most 2 degrees on each side. The box above is nowhere near this town, so no rows match. Note `coverage.state` stays `available`: coverage is town-level and a filter that matches nothing never becomes `empty`. A bounds hit was not captured: public listings omit coordinates, and no reviewed row was published in a box I could identify from the public API. In-box matching is covered by Directory tests (`reviewed-spatial`, `register-pending-runtime.test.js`).

### 5. Blocked town (200)

`GET /api/directory/towns/00000000-0000-4000-8000-000000000000/local-evaluation-listings?pagination=cursor`

```json
{
  "listings": [],
  "hasMore": false,
  "nextCursor": null,
  "coverage": { "state": "blocked", "reason": "town-ineligible", "withheldReviewedDetails": 0 }
}
```

No `sourceFreshness` or `policyVersion` for a blocked town.

### 6. Errors

In the capture, every response sent `Cache-Control: no-store` except the 401. The auth guard rejected that request before the handler ran. Fixed after the capture: gateway middleware (`apps/gateway/src/bootstrap/directory-no-store.ts`) now marks every `/api/directory` path `no-store` before any guard runs.

| Request                                                                           | Status | Body                                                                                                  |
| --------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `GET /api/directory/towns/not-a-uuid/local-evaluation-listings?pagination=cursor` | 400    | `{"message":"Invalid community ID","error":"Bad Request","statusCode":400}`                           |
| `...?pagination=cursor&cursor=<valid cursor with its tail altered>`               | 400    | `{"message":"Invalid cursor","error":"Bad Request","statusCode":400}`                                 |
| `...?pagination=cursor&bounds=-130,30,-100,50` (30 degrees wide)                  | 400    | `{"message":"Invalid cursor","error":"Bad Request","statusCode":400}`                                 |
| `...?bounds=-1,-1,1,1` (offset mode)                                              | 400    | `{"message":"Invalid bounds","error":"Bad Request","statusCode":400}`                                 |
| `GET .../local-evaluation-listings/AAAAAAAAAAAAAAAA` (unknown reference)          | 404    | `{"message":"Listing unavailable","error":"Not Found","statusCode":404}`                              |
| `GET .../$T/listing-suppressions` (anonymous)                                     | 401    | `{"message":"Unauthorized: No session credential provided.","error":"Unauthorized","statusCode":401}` |

In the capture, the oversized-bounds message in cursor mode said "Invalid cursor", because the gateway mapped any internal 400 in cursor mode to that text. Fixed after the capture: the message is now "Invalid cursor" when a cursor was sent, "Invalid bounds" when only bounds were sent, and "Invalid request" otherwise.

### 7. Unknown query parameters

`GET .../local-evaluation-listings?pagination=cursor&limit=5` returns 200 with the normal 25-entry page. The gateway ignores parameters it does not declare, so `limit` has no effect. The Directory internal route (not reachable publicly) rejects unknown parameters with 400, so the gateway only forwards a fixed set: `offset`, `q`, `adult`, `category`, `pagination`, `cursor`, `bounds`, `identities`. Page size is fixed at 25.

### 8. Offset mode (200)

`GET .../local-evaluation-listings` (no `pagination`) returns the same keys minus `nextCursor`, with no `reference` on listings: `listings`, `hasMore`, `sourceFreshness`, `coverage`, `policyVersion`.

## From tests, not captured live

These states did not occur on the local stack. The bodies below are derived from `libs/social/contracts/src/lib/directory.ts`, the gateway `projectCoverage`, and the cases in `apps/directory/test/town-coverage.test.js`, `town-coverage.postgres.test.js` and `apps/gateway/src/controllers/directory/directory.controller.spec.ts`. All are HTTP 200 with `listings: []` unless stated.

| State                          | Meaning                                                                                                                                                            | Example `coverage`                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| `empty`                        | A completed, unrevoked scan targeted the town and no listing remains.                                                                                              | `{"state":"empty","withheldReviewedDetails":0}`                               |
| `acquiring`                    | A scan targeting the town has started and none has completed.                                                                                                      | `{"state":"acquiring","withheldReviewedDetails":0}`                           |
| `partial`                      | Listings are served from a completed scan while a newer scan is still acquiring. The page has listings.                                                            | `{"state":"partial","withheldReviewedDetails":0}`                             |
| `unknown`                      | Directory has no scan target recorded for the town. Also what an absent `coverage` means to clients.                                                               | `{"state":"unknown","withheldReviewedDetails":0}`                             |
| `unconfigured`                 | No active source policy exists (nothing configured, or publication paused). Outranks unknown, empty and acquiring; never outranks blocked or a page with listings. | `{"state":"unconfigured","withheldReviewedDetails":0}`                        |
| `blocked` / `policy-withdrawn` | Every scan covering the town was withdrawn.                                                                                                                        | `{"state":"blocked","reason":"policy-withdrawn","withheldReviewedDetails":0}` |

`sourceFreshness.state` is one of `fresh`, `due`, `stale`, `unknown`. Example of a populated label (shape from the golden fixture):

```json
{ "state": "stale", "releaseId": "2026-10-21.0", "sourcePublishedAt": "2026-10-21T00:00:00.000Z", "acquiredAt": "2026-11-01T12:00:00.000Z", "thresholds": { "freshDays": 90, "staleDays": 120 } }
```

Freshness never hides listings and never changes `coverage`.

Gateway projection rules (tested): a `coverage` with an unknown state, a negative or non-integer `withheldReviewedDetails`, a `reason` on a non-blocked state, or a blocked state without a valid reason is dropped from the response rather than failing the page. A `policyVersion` that is not 16 lowercase hex characters is dropped. A failed upstream call is an HTTP error (503 `Local directory unavailable`), never a coverage state.
