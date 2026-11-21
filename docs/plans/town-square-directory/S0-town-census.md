# S0 Community town census

## Observation

- Observed: `2026-11-04T15:30:39Z` (UTC)
- Target: local Docker container `db`, database `ot_social`, table `public.community`.
- Access: ran `psql` inside the container with its `POSTGRES_USER` environment variable. No environment values or credentials were printed.
- All SQL was enclosed in `BEGIN READ ONLY` / `ROLLBACK`. No data, schema, container, or provider changes were made.
- The census covers the database state observed at this time only; it is not a durable snapshot or release approval.

## Method and scope

Inspected the Community table definition, then checked all 629 rows in seven deterministic pages of at most 100 rows (ordered by Community UUID). Page checks reported only row counts, private/public counts, system-community counts, and number of app scopes; no UUIDs or names were emitted. Aggregate queries checked app scope, privacy, locality types, missing fields, coordinate bounds, and normalized duplicate keys.

For the target candidate set, fetched every public (`isPrivate=false`) `local-hub` Community with locality type `city` or `town`, ordered by slug and name, in six read-only pages (five pages of 50 and one of 12). The inspected projection included scope, privacy/system flags, locality type, slug, city/admin-area/country, coordinate presence, and name. Results were processed for counts only; no identities are reproduced here.

Compared candidate slugs to the `localities[].slug` values in both `apps/social/src/data/seed-cities.json` and `apps/local-hub/src/data/seed-cities.json`. Both files have 425 entries and 425 unique slugs, and their slug sets are equal. This is a slug-only reconciliation, not a semantic or source-rights review.

## Findings

| Check                                                                                |                                                  Result |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------: |
| Community rows                                                                       |                                                     629 |
| App scope totals                                                                     | `client-interface`: 84; `local-hub`: 431; `social`: 114 |
| Private / public rows                                                                |                                               157 / 472 |
| System-community rows                                                                |                                                     424 |
| Public `local-hub` city/town candidates                                              |                            262 total: 180 city, 82 town |
| Candidate system / non-system split                                                  |                                                 261 / 1 |
| Candidate slug overlap with each seed file                                           |                                              261 of 262 |
| Candidate rows outside each seed slug set                                            |                                                       1 |
| Candidate missing slug                                                               |                                                       0 |
| Candidate missing city, admin area, or country code                                  |                                                       0 |
| Candidate missing coordinate pair                                                    |                                                       1 |
| Candidate slug duplicates                                                            |                                                       0 |
| Candidate normalized city/admin-area/country duplicate groups                        |                                   1 group, 1 excess row |
| Whole-table missing slug                                                             |                                                       0 |
| Whole-table missing one or more city/admin-area/country fields                       |                                                     194 |
| Whole-table missing coordinate pair                                                  |                                                     205 |
| Whole-table invalid latitude/longitude bounds                                        |                                                       0 |
| Whole-table duplicate normalized names / slugs                                       |                                                   0 / 0 |
| Whole-table normalized city/admin-area/country duplicate groups among city/town rows |                                2 groups, 10 excess rows |

The public local-hub town/city candidate predicate includes a single non-system Community as well as system Communities; callers should not assume `isSystemCommunity` alone captures all eligible public local-hub localities. The candidate-level duplicate locality key may represent separate Community records for the same normalized geography; identity resolution and lifecycle policy remain undecided.

## Privacy, app scope, and limitations

The full-table scan confirms records exist in three app scopes and that private rows are present (all observed private rows are in `client-interface` and `social` scope, not `local-hub`). The locality candidate scan was restricted to public local-hub rows. No private names, IDs, profile data, or record-level private attributes were selected or reported. `isPrivate=false` and `appScope='local-hub'` are database flags, not independent proof of public-display authorization, consent, or safe geography. No access-control or endpoint behavior was tested.

All 262 public local-hub city/town candidates have slugs and city/admin-area/country values. One lacks a complete coordinate pair; no coordinate was inferred. The single non-seed candidate is established by slug comparison only. No candidate identities are included because they are unnecessary to communicate these findings.

This census does not establish that the database is complete, current, production-backed, or representative of all town/community records. It does not resolve duplicate entities, evaluate locality accuracy or sensitive-location policy, validate app-scope enforcement, or establish import rights. Re-run against an identified authoritative snapshot before making eligibility, migration, or public-directory decisions.

## Intended source clarified — 2026-11-07

The user clarified that the existing local `ot_social` database represents the intended Social source for this deployment, and that Directory should have its own separate database. On the same day, a read-only transaction against local Docker `db` / `ot_social` counted **180 public Local Hub city communities and 82 town communities**, 262 total, using the same `isPrivate=false`, `appScope='local-hub'`, `localityType IN ('city','town')` predicate. This confirms the current local count, not a permanent census: additions, deletion, privacy and scope changes must be reconciled from Social over time. No rows were modified, and no Directory database was created or modified by the count. Directory ownership of separate persistence does not make it the privacy or eligibility authority.

A further read-only aggregate grouped the current 262 eligible rows by recorded country and administrative area: 261 use `US` and state/district abbreviations across FL 48, GA 46, NC 29, SC 28, TX 24, CT 21, MD 18, VA 12, PA 11, RI 8, MA 7, AL 4, and one each in DC, DE, NJ, NY and WV. One row records country `USA` and administrative area `Development fixture`. One row lacks a coordinate pair; none lacks city, administrative area or country in this aggregate. No individual row or owner details were reported. The fixture-labeled row satisfies the current database eligibility predicate; do not silently exclude it or treat it as a real town without resolving its intended status. The presence of Connecticut, Massachusetts, Rhode Island and New York means a US Census incorporated-places-only strategy would not cover the intended set. Counts describe this observation and must be reconciled as communities change.

## Fixture decision and implementation

The user directed Directory to exclude explicitly marked development fixtures. The one observed row has the exact administrative-area marker `Development fixture`; it is not a system community. The implementation excludes that exact existing marker in Social directory snapshots, census, event/register reads and public eligibility lookup, with a defensive check in Directory. Null areas and ordinary non-system towns remain eligible when other criteria match. This is an exact legacy marker, not a general detector for all possible fixtures; a dedicated typed marker may be warranted if additional fixture conventions are introduced. A fresh read-only count with this exclusion found **261 eligible source rows**. No shared source row was modified.

Verification: Social's focused eligibility unit suite passed 6/6. A disposable migrated PostGIS Social database passed seven focused register-read tests, including real census/snapshot SQL, both register read forms and an eligible-to-fixture update through the captured write path; the separate Directory eligibility unit passed (the optional Social-fixture PostGIS case was skipped). The Social, Directory and Directory-worker development builds passed. A two-database built-process authenticated TCP/worker bootstrap test passed with an explicitly marked fixture present: 25/25 other eligible synthetic IDs matched pending contexts and blocked work, while the marked fixture had neither an eligible Directory context nor provider work. This is isolated integration evidence, not a live gateway/end-to-end test against `ot_social` or proof that direct SQL changes bypassing capture are immediately observed. No shared stack was restarted or updated.

A read-only listing of databases on the local `db` PostgreSQL instance on 2026-11-07 found `ot_social` but no database named for Directory. This does not rule out a Directory database on another host or under another name; none was identified by this check. Do not create one in the shared instance or claim a live 261/261 comparison from the isolated 25-town test. The requested design retains separate Directory persistence.

## Exact ID reconciliation with separate disposable databases

On 2026-11-07, the current 261 eligible UUIDs (public Local Hub cities/towns excluding the exact `Development fixture` marker) were read from the intended `ot_social` source into a private temporary file. They were used as IDs only to seed a fresh isolated Social database with synthetic names and owners; a separate fresh Directory database held target state. The built Social service and two Directory workers reconciled over authenticated TCP. The checked-in `directory:test-register-wire` test passed with **262/262 eligible IDs** matching pending Directory contexts and blocked work: the 261 source IDs plus one newly added synthetic town. A separately marked synthetic development fixture received neither an eligible Directory context nor provider work. The test also exercised a synthetic create/restart/withdrawal sequence. The original source eligible UUID set matched byte-for-byte before and after the test. Both disposable databases, their container and the temporary UUID files were removed; no real provider records, source names or owners were copied. The result proves this isolated run for the observed set, not a live deployment, a production fence, verified geometry or a guaranteed operating latency.

A later isolated two-database built-process run additionally changed an eligible synthetic town's `adminArea` directly in Social SQL to `Development fixture`, bypassing application capture. The repeating sweep made the Directory town ineligible and removed its blocked provider work; after the marker was cleared it became eligible again. The test passed with 25/25 other initial synthetic eligible IDs. This proves that specific direct-write interleaving in the isolated pending-only runtime, not a general production freshness or privacy guarantee.

## Eligible duplicate geography after fixture exclusion

A read-only aggregate on 2026-11-07 using the approved eligibility predicate and excluding `Development fixture` found 261 eligible communities, no missing locality fields, no missing or out-of-range coordinate pairs, and one normalized city/state/country duplicate group containing two rows. The group is `Kill Devil Hills, NC`: one Social community is named “Kill Devil Hills, NC” and typed town; the other is named “Outer Banks, NC” and typed city. Their slugs differ but their recorded reference points are identical. The older 262-row census included the excluded development fixture when reporting a missing coordinate.

These are separate Social community identities, not automatically duplicate UUIDs or a basis to merge. “Outer Banks” may represent a regional community rather than the municipality; its intended boundary cannot be established from the identical point or the `city` field. The user directed that both remain separate. Keep the regional boundary pending and use the approved labeled approximate fallback until its area is established. No Social record was modified. Census data is a dated observation; subsequent changes must be rechecked.
