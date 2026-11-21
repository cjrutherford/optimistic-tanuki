# Public technical claims

Claims made in the "Selected engineering work" section
(`src/landing/case-studies/case-studies.data.ts`), each tied to repository
evidence. Audited 2026-11-21 from local clones and read-only `gh` queries.
Verification is one of Verified, Qualified (true with the stated limit shown on
the site) or Removed.

| Claim                                                                       | Repository        | Evidence                                                                   | Verification                                  |
| --------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------- | --------------------------------------------- |
| Public AGPL monorepo                                                        | optimistic-tanuki | `LICENSE`; `package.json` AGPL-3.0-only                                    | Verified                                      |
| Tagged Nx dependency boundaries, transitional allowlist                     | optimistic-tanuki | `docs/architecture/nx-boundaries.md`; `enforce-module-boundaries` config   | Verified                                      |
| NestJS services over TCP                                                    | optimistic-tanuki | `Transport.TCP` in service `main.ts` files                                 | Verified                                      |
| Gateway terminates HTTP, SSE and WebSocket                                  | optimistic-tanuki | `chat.gateway.ts`, `social.gateway.ts`, `@Sse` controllers                 | Verified                                      |
| Go tool compiles one deployment inventory read by Compose, k8s and CI       | optimistic-tanuki | `cmd/deployment-inventory`; `ci-cd.yml` Go tests; `deploy.yml`             | Verified                                      |
| CI: migration governance, API-client drift, format, affected gates          | optimistic-tanuki | `.github/workflows/ci-cd.yml`                                              | Verified                                      |
| No tagged releases; applications range from alpha to stable                 | optimistic-tanuki | no releases; `app-catalog.manifest.json` classifies alpha, beta and stable | Qualified                                     |
| Go daemon under systemd; CLI and dashboard share one API; SQLite            | homestead         | `docs/ARCHITECTURE.md`; `systemd/*.service`                                | Verified                                      |
| Separate privileged apply unit                                              | homestead         | `homestead-apply.service` split from the server unit                       | Qualified (design, not field-tested)          |
| Installs only an owner-approved package verified by offline minisign        | homestead         | ADR-025, ADR-063; `internal/release/verify_test.go`; `debianupdate` tests  | Qualified (design and unit tests)             |
| amd64 and arm64 `.deb` builds exist                                         | homestead         | `make deb`; `scripts/build-deb.sh`; `tests/test_s509_debian_packages.py`   | Verified                                      |
| Builds not yet signed or install-tested on an appliance; arm64 cross-built  | homestead         | `docs/RELEASING.md`; v0.0.3 draft has no `.minisig`                        | Verified (stated as a limit)                  |
| v0.0.3 is a draft, not yet public                                           | homestead         | GitHub release list (draft prerelease)                                     | Verified                                      |
| Scheduler is deterministic; one supervised FFmpeg process per item          | channel-loom      | ADRs 0003 and 0004; `engine.rs`; scheduler crate                           | Verified (design and code review)             |
| Bounded LRU precache at a capped copy rate                                  | channel-loom      | `precache.rs` byte budget and `copy_bytes_per_sec`                         | Verified                                      |
| VAAPI is the only hardware encode path, with software fallback              | channel-loom      | `engine.rs` `h264_vaapi` path                                              | Verified                                      |
| CI runs rustfmt, clippy, tests, Docker, Android TV and desktop builds       | channel-loom      | `.github/workflows/ci.yml`; main CI passing                                | Verified                                      |
| Released v0.1.2: linux-amd64 server, Tauri `.deb`, debug-signed APK         | channel-loom      | v0.1.2 release assets                                                      | Verified                                      |
| Playwright E2E is manual; ARM unvalidated; Plex and remote HTTP not started | channel-loom      | `STATUS.md`; `PLAN-REVIEW`                                                 | Verified (stated as limits)                   |
| Released v2.3.0                                                             | statocyst         | GitHub release v2.3.0 (Latest, 2026-11-17)                                 | Verified                                      |
| Embedded libSQL with versioned migrations; no cross-device sync             | statocyst         | `libs/persistence`; ADR-002, ADR-004                                       | Verified                                      |
| Separate persisted music and podcast queues                                 | statocyst         | ADR-037                                                                    | Verified                                      |
| Electron e2e checks playback, seek, skip, queue edits, restart position     | statocyst         | `e2e/desktop.spec.ts`; not in `ci.yml`                                     | Qualified (run locally, not in CI)            |
| Android Auto and screen-off runtime evidence recorded                       | statocyst         | `evidence/S057-android-runtime.txt` and related reports                    | Qualified (runtime evidence only)             |
| iOS/CarPlay, macOS and Windows not device-tested                            | statocyst         | README platform section; release assets                                    | Verified (stated as limits)                   |
| Retry classification and backoff; DVR lifecycle tests                       | epg-manager       | `recorder.ts`; `retry-resilience.test.ts`, `dvr-lifecycle.test.ts`         | Verified                                      |
| Recording in `.part` segments joined to one MP4; boot-time stitching        | epg-manager       | `recorder.ts` `.partN` and concat demuxer; startup recovery                | Qualified (partial recordings may have a gap) |
| Stream URL resolved from the database when recording starts                 | epg-manager       | README feature; recorder code                                              | Qualified (README and code review)            |
| Release workflow reruns unit and e2e and publishes a pinned GHCR image      | epg-manager       | `release.yml`; v0.6.1 release                                              | Qualified (GHCR listing not inspected)        |
| Released v0.6.1; debug-signed Android APKs                                  | epg-manager       | GitHub release v0.6.1                                                      | Verified                                      |

## Changed, qualified or removed claims

- Homestead "v0.0.3 ships signed Debian packages": removed. The release is a
  draft, the packages are not in `SHA256SUMS` and carry no signature. Copy now
  says the builds are unsigned and not install-tested, and no release link is
  shown.
- Homestead "signed package updates ... APT transaction": reworded to the
  verified design (owner-approved package, offline minisign verification) and
  marked as unit-tested only.
- TunerDaemon "writes segmented MP4": removed. The recorder writes `.part`
  segments and joins them into one MP4 at finalization.
- TunerDaemon "Published container images and versioned releases": narrowed to
  the release workflow pushing a pinned image.
- Statocyst "only one queue is active": removed. Separate persisted queues are
  documented; single-active behaviour was not confirmed.
- Statocyst "Electron end-to-end tests assert ...": qualified as run locally,
  not in CI.
- Optimistic Tanuki "current build and test status sits on the Actions tab":
  removed, because it implied a healthy main. Copy states the gates that exist.
- Optimistic Tanuki workspace project counts: removed. The totals include e2e
  projects and libraries and do not count products.
- Optimistic Tanuki "portfolio of products": qualified with "applications range
  from alpha to stable"; no production-readiness claim is made.
- ChannelLoom ARM or multi-arch support and full ErsatzTV parity: not claimed.
- No metrics, adoption figures, or links to playable media appear in the
  section.
