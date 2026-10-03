# @optimistic-tanuki/civic-briefing-data-access

Angular clients for the gateway's local-hub civic routes (plan slice P4.1),
ported from the Daylight POC web app:

- `EditionsService`: the public edition and briefing routes
  (`local-hub/editions/*`).
- `CommunityService`: contributions, the community surface, contributor
  pages, official applications and copyright notices.
- `MembershipService`: the signed-in account's local-hub roles and
  permissions (`local-hub/me`).
- `OperationsService`: the operator routes (`local-hub/operations/*`).
- `problem` and `problemCode`: what to tell someone when a request fails.

The routes wrap every reply in `{ data }` and take a multipart upload, so
these are written by hand rather than generated with orval. The response
shapes come from `@optimistic-tanuki/models`.
