# Slice 11 progress — 2026-09-28

Slice 11 is **implemented in part and not accepted for production**. The code in this shared checkout is uncommitted. The generated customer package is labeled `PREVIEW — INCOMPLETE`; it has not passed a clean-volume, full-stack owner sign-in and proposal run. HAI has no approved API accounts for the four specified distributors, so live sourcing has not been accepted.

## Implemented in this checkout

- Commercial quotes use an owner-selected supplier offer snapshot, a 30-calendar-day expiry, the specified customer hardware formula `raw distributor cost × 1.08 × 1.35`, and a separate internal 10% reserve. Pricing tests cover 24/36-month lease calculations, 15% annual maintenance, and the 70% retainer margin floor.
- Supplier offers have a persisted source channel. File imports are fallback data and cannot issue a firm quote. An Amazon Business Product Search connector and owner-triggered sync path can store `live-api` offers, but return 503 until an approved account is configured. Dell has an OAuth/catalog adapter that still needs its partner response schema; CDW and Newegg Business have no live buyer connector.
- Gateway owner routes require an authenticated Owner Console scope and role. The HAI Computer operator page can search for Amazon offers, choose eligible live offers, issue and accept a quote, commit an accepted quote to Lead Tracker, and download a quote-bound package. Lead Tracker commits use the accepted server snapshot and recover safe concurrent retries.
- The owner download is a private, no-store tar.gz containing `docker-compose.client.yml`, `.env`, Gateway config and composition, `bootstrap-owner.mjs`, and proposal Markdown. Generated secrets are 256-bit values; `.env` has archive mode `0600`. Only the HAI Computer portal is a web app in the package. The package also includes required backend services, PostgreSQL, Redis, and a loopback-only Admin API for first-owner setup.
- Authentication, Profile, Permissions, Lead Tracker, and System Configurator API have opt-in, bundled runtime migrations for a fresh appliance database. The generated package still requires end-to-end boot and owner login proof.
- Public tier descriptions no longer expose the legacy hardcoded retail or lease prices; a firm price requires an owner-issued quote.

## Verification evidence

| Target                               | Result                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| System Configurator portal           | 11 suites / 77 tests; production build passed                                                                                                                                                                                                           |
| System Configurator API              | 12 suites / 75 tests; production build passed                                                                                                                                                                                                           |
| Gateway                              | 102 suites / 1,444 tests; production build passed                                                                                                                                                                                                       |
| Lead Tracker                         | 35 suites / 220 tests; production build passed                                                                                                                                                                                                          |
| Authentication, Profile, Permissions | 194, 41, and 110 tests respectively; builds passed                                                                                                                                                                                                      |
| Admin API                            | 15 suites / 88 tests; production build passed                                                                                                                                                                                                           |
| TypeORM                              | `pnpm run validate:typeorm-migrations` passed; fresh PostgreSQL applied 7 Authentication, 2 Profile, 2 Permissions, 24 Lead Tracker migrations; reruns found none pending. System Configurator API applied its 3 migrations on a fresh database.        |
| Generated package                    | `docker compose config -q` passed; Gateway config/composition loaded; tar.gz extracted all six files with `.env` mode `0600`. Built Admin API started without workspace/Docker socket mounts and returned setup status through the token-guarded route. |

## Remaining acceptance work

1. Provision approved HAI accounts, terms, documentation, and credentials for CDW, Newegg Business, Amazon Business, and Dell OEM. Implement CDW and Newegg buyer connectors and Dell's account-specific catalog normalizer/live sync; run live price and availability tests for all four. [Account checklist](../operations/slice-11-distributor-api-onboarding.md).
2. Boot the generated package from empty customer volumes with the intended images. Create the first owner through `bootstrap-owner.mjs`, verify login and Owner Console role, perform Amazon sync with an approved account, issue/accept a quote, download the package, and commit a proposal to Lead Tracker. Keep the package labeled preview until this succeeds.
3. Configure and verify SMTP and any customer DNS/TLS/reverse-proxy settings for the appliance. Verify the public `hardware.hopefulaspirationsindustries.com` deployment and API routes after release; the local code and unit tests do not prove the public host has been updated.

The earlier [Slice 07–08](2026-09-27-slices-07-08-closeout.md), [Slice 09](2026-09-27-slice-09-closeout.md), and [Slice 10](2026-09-27-slice-10-closeout.md) reports remain the source for those slices. Their existing production acceptance gaps are not resolved by Slice 11 work.
