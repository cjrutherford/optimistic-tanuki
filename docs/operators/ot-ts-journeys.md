# OT/TS local journey verification

The existing R4-01–R4-05 gates cover OT (`client-interface`), TS (`local-hub`)
and their required shared services. They do not qualify external OAuth/email,
card processing, payouts, production deployment/load or backups.

## Private fixture

Build the affected applications through Nx before using `--skip-build`.
The runner requires the checked-in dependencies, Docker, system Chrome and
cached `postgres:16-alpine` and `alpine:latest` images. Ports 19080/19081 must be
free. It does not alter the shared Compose stack or read operational YAML.

```sh
python3 tools/r4-scanner-private.py --run
```

The outer runner owns a disposable Alpine container, installs ClamAV inside
that container only, and verifies the real engine with an EICAR positive control.
Its database contains one explicitly declared test signature. This establishes
the local streaming/recovery seam; it does not qualify production malware
definitions. No scanner is replaced by a successful fake. Production needs an
operated scanner and current definitions before uploads can be offered.

The nested runner migrates twelve fresh owner databases, boots real owner TCP
services and two guarded Gateway processes, starts the production Assets internal
media HTTP server on a reserved loopback port, then opens both rebuilt Angular
applications in system Chrome. It uses synthetic, fixture-verified identities
and sessions. The permission fixture loads the relevant subset of the checked-in
standard seed; authorization handlers and checks remain real. Disabled AI/store
endpoints cannot return successful results and are outside the qualified journeys.

Artifacts live under `.runtime-artifacts/release-r4/scanner-*` and the nested
`.runtime-artifacts/account-rights/deletion/d27-live-*` directory. The R4 mode
writes `acceptedJourneys`, with `acceptedLocalProtocol: false`; it does not
claim another deletion-protocol acceptance. Teardown checks the application
tables, stops its SSR/owner processes and removes only its labeled containers.

## What the checks establish

- Account cookies restore the intended app/account; foreign and wrong-app
  profiles cannot be selected. An owned global secondary profile is tested.
- TS locality and both apps’ private community membership respect owner/member/
  nonmember boundaries. Discoverable overviews remain available with member/chat
  details redacted; private membership reads are denied.
- TS buyers create offers and sellers accept through the actual UI. A card
  record remains pending and cannot be manually confirmed through the offline
  endpoint. The separate cash receipt path tests local confirmation, release,
  wallet accounting and duplicate-release behavior. Unsafe offer/counter/payment
  amounts are rejected before persistence, including amounts whose fees would
  make seller proceeds negative. This is not proof of money
  movement or a working external card processor.
- The exercised account controls and buyer/seller dialogs receive scoped axe,
  keyboard, focus and responsive checks. This is not an all-page accessibility
  certification.
- Upload activation failure is injected in PostgreSQL after real scanning.
  A nontransactional sequence proves the fault was reached; independent rows
  and files prove compensation before retry. An aborted-before-wire offer
  preserves the draft and creates one record on explicit retry.
- Deep-link reloads recover the listing. Both app scopes reconnect to actual
  chat handlers using stable message IDs; independent counts reject duplicate
  persistence. Revoked sessions cannot write or recover protected history.

Scanner unavailability remains fail-closed and is reported as a retryable 503.
Account deletion, retention and artifact custody retain their separate accepted
contracts. A local journey receipt never substitutes for an external release
sign-off.
