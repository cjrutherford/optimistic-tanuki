# S019 — QR and Campaign Validation

## Status

Ready

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

- [ ] QR target paths resolve on the dev server
- [ ] UTM parameters are accepted and recorded by the S014 tracking
- [ ] Campaign destinations documented with their production URLs

## Validation

- Run the dev server bound to the LAN, open each campaign URL with the owner,
  and scan each test QR code with a phone (D009).

## Expected Files / Areas

- print campaign documentation

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
