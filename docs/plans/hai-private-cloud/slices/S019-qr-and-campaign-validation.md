# S019 — QR and Campaign Validation

## Status

Complete

## Objective

Define the final print campaign URLs and validate them, and their QR codes,
with the owner against a running dev server.

## Why this slice exists

Print QR codes should only be finalized once the routes and campaign handling
they point at are confirmed to work. Production is not available yet, so
validation happens on the dev server with the owner (D009).

## Dependencies

S017

## In scope

- define final UTM URLs for every print piece
- serve the site on the LAN so a phone can reach it
- generate test QR codes that encode the dev-server host with the final paths
  and query strings
- validate each destination and its campaign tracking with the owner
- document the production URLs the print QR codes must encode

## Out of scope

- Website feature changes
- Production deployment (owner's manual step; see S018)

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md
- ../09-DECISION-LOG.md (D007, D009)

## Implementation Requirements

- Test codes differ from print codes only in scheme and host. Path and query
  string must be byte-identical to what will be printed.
- Print QR codes encode `https://hopefulaspirationsindustries.com/...`; they
  are final only after the owner confirms the routes in production (D007).

## Acceptance Criteria

- [x] QR target paths resolve on the dev server
- [x] UTM parameters are accepted and recorded by the S014 tracking
- [x] Campaign destinations documented with their production URLs

## Validation

- Run the dev server bound to the LAN, open each campaign URL with the owner,
  and scan each test QR code with a phone (D009).

## Expected Files / Areas

- print campaign documentation

## Completion Notes

### Campaign destinations

The three print pieces are the ones planned in
`06-SEO-ANALYTICS-ACCESSIBILITY.md`. They are now listed once, in
`scripts/hai-print-campaigns.txt`. The QR generator and the release smoke test
both read that file, so the printed path and query can't drift from what is
tested.

| Piece                    | Print QR code encodes                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `flyer-private-cloud`    | `https://hopefulaspirationsindustries.com/private-cloud?utm_source=print&utm_medium=flyer&utm_campaign=private_cloud`                  |
| `brochure-private-cloud` | `https://hopefulaspirationsindustries.com/private-cloud?utm_source=print&utm_medium=brochure&utm_campaign=private_cloud`               |
| `brochure-oss-stack`     | `https://hopefulaspirationsindustries.com/private-cloud/open-source-stack?utm_source=print&utm_medium=brochure&utm_campaign=oss_stack` |

To add a print piece, add a line to the campaign file and regenerate.

### QR codes

`node scripts/hai-campaign-qr.mjs <origin> <out-dir>` writes, for each piece:

- an SVG for print;
- a 600 px PNG;
- `index.html`, a sheet showing every code with the URL it encodes.

Codes use error-correction level Q (survives about 25% damage) and the
standard four-module quiet zone.

- **Print codes:** generated with origin
  `https://hopefulaspirationsindustries.com` into
  [`../assets/s019/print/`](../assets/s019/print/index.html).
- **Test codes:** generated with the dev server's LAN origin. They're not
  committed, because the address is specific to one machine.

### Validation on the dev server

The production SSR build was served on the LAN (`http://192.168.1.153:4000`)
with `SSR_ALLOWED_HOSTS` including the LAN address. Its `/api` went to a
gateway built from this branch, which ran beside the dev stack and used the
dev Redis.

- **Codes decode correctly.** Every PNG, print and test, was decoded with
  jsQR. Each one returns exactly its campaign URL. The print sheet was
  rendered and inspected.
- **Destinations resolve.** `scripts/smoke-test-hai.sh` against the LAN origin
  passed all 54 checks, including the three campaign URLs (200, page title and
  production canonical URL).
- **Tracking is recorded.** Each decoded test URL was opened in a 390 × 844
  browser.
  - Each scan added one `page_view` to the campaign tier, with source `print`
    and the right medium and campaign.
  - The counts appear on `ot_site_events_total` with the same labels.
  - The campaign is kept for the visit (`hai.campaign` in session storage),
    which is what the contact and assessment forms append to `sourcePage`.

### Owner phone scan (2026-10-11)

The owner scanned all three test codes with a phone on the LAN and approved
them.

- **Flyer and brochure:** both opened `/private-cloud`. That is intended; only
  `utm_medium` differs.
- **Open-source brochure:** opened `/private-cloud/open-source-stack`.

The counters recorded the phone's flyer visit. The two brochure scans opened
their pages but added no count. The reason wasn't found. Possible causes are a
privacy signal (GPC or DNT), a scanner preview that never ran the page, or a
reused tab. Recording itself was shown to work for all three codes in the
browser test above.

### Left for the owner

- **After deploying:** scan the print codes against production before sending
  anything to print (D007). Confirm in Grafana that each scan is counted.

## Deviations / Blockers

- **Host allow-list:** Angular SSR returns 400 for any host that isn't
  allowed, so a LAN server needs `SSR_ALLOWED_HOSTS`. Production needs the
  same: set `SSR_ALLOWED_HOSTS`, which covers `hopefulaspirationsindustries.com`,
  on the deployed HAI service. Neither Compose nor the k8s manifests set it
  for HAI by default.
- **Host firewall:** `ufw` is active on the dev host. If a phone can't reach
  port 4000, allow it from the LAN.
