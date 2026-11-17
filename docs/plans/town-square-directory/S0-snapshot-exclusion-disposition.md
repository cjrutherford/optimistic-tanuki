# S0 snapshot exclusion dispositions

Reviewed 2026-11-07 against the [gap review](S0-gap-review.md) and [capability review](S0-capability-review-2026-11-07.md). The private 165-file snapshot is a selected source reference, not a complete copy of the dirty POC. This table records the present engineering disposition; it does not authorize a future import or establish a reproducible complete checkout.

| Excluded material | Disposition and consequence | Owner |
| --- | --- | --- |
| Modified `docker-compose.yml` | Do not transplant local configuration or values. The full-scan directory setting identifies a staged input; when an approved import design exists, document the needed setting and verify a sanitized target configuration. Until then, the snapshot alone cannot reproduce that source setup. | S4a; S9 for deployment |
| Modified `tsconfig.base.json` | Do not transplant the POC path alias. Map required domain contracts into target-owned contracts and verify imports as each target capability is built. The snapshot alone cannot reconstruct the alias. | S4/S5 |
| Modified `apps/directory-poc/public/map/osm-standard-style.json` | Do not assume tile or glyph permission from an attribution string. Choose and review target map and font dependencies in the UI work; the snapshot does not reproduce that style. | S6/S9 |
| `config/provider-manifest.geoapify-reverse-locality.json` | Keep as a source-side policy reference only. Its enabled/public-readable assertions and 65-call limit do not authorize target requests or override the shared $25 monthly ceiling. | S4b |
| `tools/overture/normalization-replay-proof.compose.yml` and `tools/overture/taxonomy-proof.compose.yml` | Treat as source proof scaffolding, not production configuration. Reproduce needed proof with sanitized target-owned fixtures; review wiring when a specific behavior depends on it. | S4/S9 |
| `tools/overture/taxonomy-resume-proof-artifact.manifest.json` | Do not copy by default. If a claim depends on it, inspect the minimum metadata for sensitive paths and record a scoped hash and its limitations before relying on it. | S4/S10 |
| `tools/overture/taxonomy-resume-proof-artifact.jsonl` | Exclude potentially derived/provider records. Generate synthetic evidence when possible; any real-record use needs the applicable source-use and acquisition decisions. | S4 |
| Fourteen `.playwright-mcp` page captures and console logs | Exclude potentially sensitive browser artifacts. Reproduce any needed interaction using synthetic target data and fresh evidence. | S6/S7/S10 |

These categories account for the 22 changed/untracked paths omitted from the 165-file selection: three modified files, three additional source/configuration files, one proof manifest, one proof payload and fourteen browser artifacts. Other excluded ignored files, provider data, secrets, dependencies and generated outputs are not counted in those 22. The source status and selected hashes must be checked again immediately before any later authorized import; a changed path set requires a new disposition. Source feature parity, review of any newly necessary material, and human review of the eventual exact transfer list remain open.
