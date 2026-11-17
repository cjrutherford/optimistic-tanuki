# S4 provider readiness — S4a.1 Overture source policy

> **Later decision:** The user approved conditional private use of the October 2026 release for the four-town review. The historical September cohort and draft matrix discussed below were not thereby approved for transfer; see [the October proposal](S4a1-fresh-release-proposal.md) and [decisions](DECISIONS-2026-11-07.md). Paid acquisition and public launch remain separate.

**Status: draft; not approved or enabled.** This packet prepares a source-use decision for the historical Overture Places cohort. The [machine-readable draft](S4a1-overture-policy.draft.json) is not wired to a runtime authorizer and grants no new target import, public display, export, provider acquisition or rollout. Its unknown decisions must be denied by any eventual enforcement. On 2026-11-06, the user volunteered to perform the source-use review; no name or decision was provided. S4a.2 and S4a.3 remain separate gates.

## Selected historical artifacts

The POC's selected four-seat artifacts use data release `2026-09-23.0`, schema `v2.0.0`, parser `overture-official-row-v2`, query `overture-four-seat-envelope-intersection-v1`, and a 16-item source-inventory identity `35c72b40ae302e8e102a9cbfc92f2abf30de37a76b4a116b6f7c75029d728d74`. This inventory identifies selected object metadata; it is **not** a full upstream-release checksum. Historical geometries and taxonomy hashes remain in the manifests and [source-use record](/home/cjrutherford/workspace/business-directory-poc/docs/source-use/overture-2026-09-23-waycross.md).

| Artifact | Rows | Artifact SHA-256 | Manifest SHA-256 | Decision |
| --- | ---: | --- | --- | --- |
| Four-seat v2 | 20,811 | `72355d674966b9f84d4293be9420f6ced0d454247d005e739bac014de728237c` | `7f43ebf8b964d69cdbc843d61e0c305316e3ce206237e37f67d6803d8c7d8422` | Historical private POC use only, subject to the conditions below. |
| Four-seat v3 | 20,811 | `bdf016ac9e755e2222220173636a70adfd735a87933fa69cea7de40188846488` | `edf67913b52fc16dc71c6b735758e4627431a87eb3d805292507a35f5a754d02` | Derived from v2; same limited private scope. |
| Waycross sample | 100 | `fc056e6eb056c9ca8fa64c3917485c16c4032ce25ee0a3fc5e84836607b4c9c0` | `88c8cec77601b5d4ae22190f84a332f9e3f4020272dd27f125f41742f4cc3b4b` | **Unknown:** manifest says schema `v1.18.0`, conflicting with the release evidence. Do not use it as clearance for either four-seat artifact. |

Hashes and line counts were recomputed read-only on 2026-11-06; no records were copied into the target. The POC checkout was branch `feat/directory-poc-slice-1`, HEAD `9948a2371fee6051c49932bfae7dcf6e732efc0a`, with 166 status entries. This identifies the observation, not a clean or reconstructible snapshot. Recheck hashes and review changed inputs immediately before any later authorized import.

The inspected historical source-use record SHA-256 was `31b1256d70995ca2bb104f1daf36bd79465bd5be8e3f91cd3476a25460bc09ff`; the POC rights-policy source was `d1f44971555af1bfc62d6fadc59762f1f97255f4c0421b9e1336e68af2e8b009`; and the regional-policy source was `b7ff6982cb3facf6003c52aa54cbec6b82cd6fdf3a4490a6d543a1b8baecc7c1`. These fingerprints identify local files observed during this review; they are not signatures, legal approvals or a copy of the original upstream terms.

The [September release notes](https://docs.overturemaps.org/blog/2026/09/23/release-notes/) identify `2026-09-23.0` with schema v2.0.0 and describe a `.1` patch affecting base and building-part IDs. The current sample fetcher hard-codes `schemaVersion = 'v1.18.0'` while writing release `2026-09-23.0`; its observed SHA-256 is `4b233652e41d535d00639417dea754ce66bb672274fc0555ed750a455cadf95b`. An aggregate inspection found `basic_category` and taxonomy primary/hierarchy non-null in all 100 sample rows, but those fields alone do not establish the complete upstream schema or the historical fetcher identity. The label conflict remains unresolved. The release notes do not prove that `.0` and `.1` artifacts are interchangeable. The [release calendar](https://docs.overturemaps.org/release-calendar/) listed `2026-10-21.0` as current when checked and states public release files are retained for at most 60 days. Do not silently switch releases or assume an older asset remains downloadable.

## Existing decision and operation matrix

The POC's dated source-use record approves rights-classified private persistence and private Tailnet display for the exact historical four-seat cohort, including adult only with explicit opt-in. It excludes public display, export and redistribution. That is evidence of a historical POC decision, not a new grant for the target, a legal conclusion, or a blanket approval of all contributors and fields.

| Operation | Historical POC cohort | New target or public operation |
| --- | --- | --- |
| Retain and display privately | Conditional historical approval for mapped fields and sources; unknown required fields quarantine the record, unknown optional fields are omitted. | **Unknown; deny enforcement** until separately approved. |
| Ingest a new source or target copy | Existing staged data only; this packet authorizes no new acquisition or import. | **Unknown; deny enforcement.** |
| Public display | Not approved. | **Unknown; deny enforcement.** |
| Export / redistribution | **Denied by the historical POC decision.** | **Unknown; deny enforcement.** This is an internal clearance decision, not a claim that all upstream licenses prohibit export. |
| Enrichment or derived data | Retain distinct lineage and existing restrictions; no blanket inheritance. | **Unknown; deny enforcement.** Geoapify reverse-locality and standalone AllThePlaces require separate product/source decisions. |

The JSON draft is a normalized matrix: contributor/license rows, field groups, operation decisions and scope conditions combine; no row is an unconditional public allow. A missing field, contributor, transform, release, license, geography or applicable notice remains unknown and must fail closed. The POC `eligible` evaluator status below concerns provenance mapping, **not** public permission, content completeness, accuracy, or reviewer approval.

## Full staged metadata inventory and private replay

Both four-seat files were streamed read-only with [the aggregate inventory tool](../../../scripts/overture-rights-inventory.mjs); no record values or IDs were emitted. Each contained 20,811 valid JSON records, 54,744 source entries, no record with missing/empty `sources`, and no source entry missing dataset or license. Each had 20,811 root pointers, 20,811 confidence pointers, 13,122 operating-status pointers and no other/malformed pointers. These are source occurrences, not unique businesses or proof of legal lineage.

| Root contributor | License recorded in staged rows | Root occurrences | POC mapping |
| --- | --- | ---: | --- |
| meta | CDLA-Permissive-2.0 | 13,602 | Mapped |
| BrightQuery | CDLA-Permissive-2.0 | 3,137 | Mapped |
| Microsoft | CDLA-Permissive-2.0 | 2,597 | Mapped |
| Foursquare | Apache-2.0 | 1,021 | Mapped; NOTICE requires separate review |
| AllThePlaces | CC0-1.0 | 326 | Mapped for its Overture contribution, not standalone archives |
| DAC | CDLA-Permissive-2.0 | 122 | Mapped |
| PinMeTo | CDLA-Permissive-2.0 | 1 | **Unmapped in POC** |
| RenderSEO | CDLA-Permissive-2.0 | 5 | **Unmapped in POC** |

Overture/CDLA appeared in 20,811 confidence entries and Overture-signals/CDLA in 13,122 operating-status entries; neither was an additional root contributor in this cohort. Those signals are not currently cleared for public projection. Current [Overture attribution](https://docs.overturemaps.org/attribution/) lists PinMeTo and RenderSEO under CDLA, but a current page and staged license label do not by themselves approve the September cohort or its transformations. The six unmapped records remain review/quarantine candidates, not silently eligible.

The POC evaluator's configured retained pointers cover name, basic category, taxonomy primary/hierarchy, geometry, taxonomy alternates, address, phone and website. In these artifacts, the root source is the selected applicable source for those fields; the two explicit pointer kinds apply to confidence and operating status instead. A direct, read-only replay of the **actual POC evaluator**, with no overlays, returned **20,805 provenance-eligible / 6 required-field review** records for each file. Every configured required field returned 20,805 `eligible` and 6 `review`; each optional field returned 20,805 `eligible` and 6 `omitted`. These statuses do not mean fields exist: for example `basic_category` was non-null in 20,424 rows and taxonomy primary/hierarchy in 20,369. Arrays counted as non-null can be empty. Derived `assignedCategoryIds` appeared in all rows; v3 additionally had 311 non-null `assignedPlaceTypeId` values. The v2 and v3 taxonomy mapping hashes and v3 parent hash are in the draft manifest. Their lineage must include source taxonomy, mapping version and any geometry/seat association; a derived category does not acquire permission independently of its inputs.

`id`, `sourceFileRowNumber` and the derived `assignedSeatId` were non-null in all 20,811 rows of each artifact. `assignedSeatId` depends on source geometry, four seat geometries and the declared priority Douglas → Tifton → Valdosta → Waycross. The manifest pins the seat geometry SHA-256 values to `eff0af2eb6ce36fa389842de6d5d679c0253d073a5af44c02d6402ee6d600c99`, `ed9c1b4f11db4d9d8c65d36a785dbeb1d161f82208660e771283c6918513aa6d`, `3dc105a4006ad14b146db2122d65fe8e464388b07850be586a2f24a6708fa88e` and `21646e863343da4c07f6d8e372bb7f85f88b866a359a07fd6b7e3bf71c74e588`, respectively. The current [fetcher](/home/cjrutherford/workspace/business-directory-poc/tools/overture/fetch-four-seat-scan.ts) uses `ST_Intersects` and priority order; its observed SHA-256 is `b4d42b75ce91417bb726ab6c26794fe76f529f83f5b277de469cca17b2575e74`. However, the artifact manifest records query version `overture-four-seat-envelope-intersection-v1`, while the current fetcher's new-manifest default is `overture-four-seat-rowgroup-stream-ordered-v3`. The current source can read an existing manifest, so this difference does not prove corruption; it does mean the exact historical transform/code identity needs reconciliation. Target use of `assignedSeatId` remains **unknown**. `sourceFileRowNumber` is internal provenance and is not approved for public display. The current v3 reclassification script's SHA-256 is `6590202b7befedf3830feadf6fa827b3c007e51c061cad2b016b3687fa485f8f`.

`addresses`, `phones` and `websites` are optional source fields, not public approvals. The POC also contains Geoapify reverse-locality evidence with separate provider lineage and non-exportable approximate-location treatment. Keep it distinct from source addresses and from Overture permissions. Confidence, operating status, personal or residential details, adult/sensitive locations and unreviewed enrichment remain withheld pending their own rights and privacy decisions under the [HAI philosophy](../../product/HAI-PUBLIC-GOOD-PHILOSOPHY.md).

The focused POC policy suite passed **17/17** tests. The new aggregate-tool and draft-safety tests passed **4/4**. The direct evaluator returned these exact summarized fixture outcomes:

| Case | Record eligible | Name status | Review | Impact / reason |
| --- | --- | --- | --- | --- |
| Known mapped Meta/CDLA root | `true` | `eligible` | `false` | `none` / `[]` |
| Unmapped PinMeTo/CDLA root | `false` | `review` | `true` | `quarantine_record` / `unmapped_source_terms` |
| Mapped Meta root with explicit excluded-name overlay | `false` | `excluded` | `false` | `quarantine_record` / `[]` |

These are examples of the POC's provenance classifier, not operation-specific legal decisions or evidence of target enforcement. The target has no approved public projection in this slice; an actual withdrawal test covering indexed/cached public fields remains required before public enablement. No such test has been established here.

## Current primary-source fingerprints

The following SHA-256 values identify the exact public HTTP response bytes retrieved on 2026-11-06 around 19:00 UTC. They are fingerprints of **current** material, not proof of the terms in force at the September acquisition; HTML may change. No legal conclusion or historical approval follows from a matching source name alone.

| Source | SHA-256 |
| --- | --- |
| [Overture attribution and licensing](https://docs.overturemaps.org/attribution/) | `95dafe36193495560ee775eddaff69aa263b37087c19beb3caad0bedc540eef6` |
| [Overture release calendar](https://docs.overturemaps.org/release-calendar/) | `7497785ab0ee60e479ca1fa64ee74abfea167751c1a16c93bc42526d7b0e8ca3` |
| [September release notes](https://docs.overturemaps.org/blog/2026/09/23/release-notes/) | `061b1b6c10032b5e4560eb1fa164aeb2e3714adf4e6dc345e903de543009e479` |
| [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/) | `6485ebb99d0ce73026b57f46cd7f34282797d069044d37889782de57167df968` |
| [Apache License 2.0 text](https://www.apache.org/licenses/LICENSE-2.0.txt) | `cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30` |
| [CC0 1.0 legal code](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | `b43732f4c1463b087cf10d4daf8d8766514b2bf8f21bc5ef50905f95be227726` |
| [Foursquare notice](https://opensource.foursquare.com/places-notice-txt/) | `0200dc7ff5fab86b03c23ab6cb1aae220222550300004425494e580b653360d3` |
| [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) | `04908a9e2faf70ad3090b3b2db43de100f3ad61243c578413b67fb57ba6b6912` |

CDLA 2.0's text requires the agreement to be made available when sharing data. Overture lists Foursquare under Apache 2.0 with its notice, and Foursquare's current notice describes license, change-notice and attribution requirements. The specific handling, historic evidence, exact notice contents and applicability to each operation require reviewer confirmation; this packet does not clear a public notice implementation.

The POC policy's exact Foursquare terms URL, `https://github.com/foursquare/fsq-os-places`, returned HTTP 404 when checked on 2026-11-06. The current Overture attribution page instead links the Foursquare notice above. The POC reviewer workflow matches its configured URL exactly, so do not silently substitute a new URL or treat the dead link as verified historical terms; reconcile and review the mapping before authorizing reuse.

## Boundary and tile rights are separate

Current [Overture Places guidance](https://docs.overturemaps.org/guides/places/) says the Places theme does not contain OpenStreetMap data. This is not a statement about other themes, historical data or an independently derived combined database. Overture's [attribution page](https://docs.overturemaps.org/attribution/) lists Divisions under ODbL and includes other source-specific terms. Town boundaries and containment remain a separate S2 rights/privacy gate.

Local Hub currently references `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` in [its map component](../../../apps/local-hub/src/app/components/map/map.component.ts). The current [OSM tile policy](https://operations.osmfoundation.org/policies/tiles/) specifies the non-subdomain tile URL and imposes separate attribution, identification, caching and no-prefetch requirements. This is a source-policy finding, not proof that the current UI or a production deployment meets those requirements. Tile delivery and attribution require their own review; no tile usage or client behavior was changed in S4a.1.

## Review and next gates

1. Resolve the sample schema-label conflict and assess whether to exclude that sample permanently. Confirm the exact historical terms/notice evidence and review the six unmapped root records without exposing record contents.
2. The user has volunteered to review. Record the reviewer's name and decision date when supplied, alongside the retention/withdrawal schedule, permitted geography, evidence fingerprints and expiry/re-review trigger. Approve or deny each contributor/field/operation combination; keep unspecified combinations unknown and denied. The current draft is not a reviewer decision.
3. Before public enablement, implement and test operation-specific evaluation across complete field/derived lineage, including actual indexed/cache/export withdrawal, notices, sensitive-place handling and the private quality pilot. No source presence, passing unit tests, human click, current documentation or prior Tailnet approval alone grants public rights.
