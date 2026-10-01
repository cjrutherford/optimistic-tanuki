# Daylight port: upstream drift since the vendored commit

Slice P0.2 of `2026-09-30-daylight-civic-briefing-integration.md`. This note
measures how far this repository has moved since the Daylight POC vendored
code from it (`7e1d8740`, 2026-09-15; 204 commits ago, HEAD `bd800bdd`). It
records what each port slice has to handle as a result.

## Method

The POC's `docs/upstream-map.md` lists every vendored file and its upstream
path (431 rows). For each row the vendored body, with the header stripped,
was compared with the upstream file at `7e1d8740` and at HEAD. The POC's
Tier 2 code (`apps/pipeline`, `apps/gateway`, `apps/community`, `apps/web`,
`packages/*`) was then searched for imports from vendored modules. The
symbols those imports name were diffed between the two commits. The POC was
only read.

## Result

|                                     | Files                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Unchanged upstream since `7e1d8740` | 344                                                                                                                 |
| Changed upstream                    | 87 (mostly SCSS in common-ui, form-ui and theme)                                                                    |
| Modified locally in the POC         | 6, all in `constants`/`models` barrels and profile re-exports                                                       |
| Upstream path missing at `7e1d8740` | 11: `libs/profile/contracts` was added after the reference commit (294d38dd); the POC's headers cite the later path |

**The pipeline has no upstream dependencies.** `apps/pipeline` and every
`packages/*` lib (core, llm, adapters, community, access) import nothing from
vendored code. Drift therefore cannot affect P1.1–P1.6 or the parity gate.
Only the gateway, community and web apps use vendored code.

## Drift that affects a port slice

| Consumer → symbol                                                                     | Change upstream                                                                                                                                                                                                                                                | Affects                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| community → `LocalStorageAdapter` (`surface.service.ts`, `uploads/artifact-store.ts`) | `create()` now envelope-encrypts at rest and fails with 503 when `VAULT_STORAGE_KEK` is unset. `read()` rejects files that aren't envelope-encrypted. Files are written with mode 0600/0640. A declared type that contradicts a tax-form signature gets a 422. | **P2.5**: set `VAULT_STORAGE_KEK` (and `_ID`) in env, compose and tests, or inject `EnvelopeEncryptionService` the way `StorageModule` does. No beta artifacts carry over (D6), so plain files are not a problem. |
| community → its own scanner                                                           | Upstream's `VirusScanService` is now a ClamAV client that fails closed (503 without `CLAMAV_HOST`, 413 over 25 MiB).                                                                                                                                           | **P2.5**: use upstream's scanner with `CLAMAV_HOST` rather than the POC's own.                                                                                                                                    |
| `FileValidationService`                                                               | Unchanged. It still admits SVG and still trusts the declared MIME type.                                                                                                                                                                                        | **P3.3**: that finding stays open. The POC doesn't use this service, so it doesn't block the port.                                                                                                                |
| gateway/community → `ServiceTokens`, `ProfileCommands`                                | Additions only (`CIVIC_SERVICE`, `PAYMENTS_SERVICE`, `BILLING_SERVICE`, …). `ProfileCommands` is now re-exported from `@optimistic-tanuki/profile-contracts` with the same values.                                                                             | P2.5, P3.x: import the real barrels. Nothing the POC added locally needs to land upstream; HEAD already has it.                                                                                                   |
| profile contracts                                                                     | 8 of the POC's 11 copies are identical to HEAD. `create-profile.dto.ts` and `update-profile.dto.ts` differ, and HEAD's are richer.                                                                                                                             | P3.2, P5.1: use HEAD's `libs/profile/contracts`.                                                                                                                                                                  |
| web → `ParticleVeilComponent`, `IconComponent`, `provideProductTheme`                 | Same inputs and signatures. The veil's internal CSS variables were renamed (`--scene-speed-input`, `--scene-intensity-input`), the home glyph changed, and theme output adds personality-extension variables.                                                  | P4.2, P4.4: look at the result rather than assume it matches the POC. Don't target the veil's internal variables.                                                                                                 |

## No drift

These are byte-identical at `7e1d8740` and HEAD, or changed only in ways the
POC doesn't use:

- The gateway's `AuthGuard`, `PermissionsGuard`, `PermissionsCacheService`
  and the `Public`, `User` and `RequirePermissions` decorators.
- The four local-hub auth guards and services the POC vendored.
- `AppScopeCommands`, `RoleCommands`, `AuthCommands`, `AssetType`,
  `StorageStrategy`.
- `ButtonComponent`, `TextInputComponent`, `TextAreaComponent`,
  `AppBarComponent`, `NavSidebarComponent`, `NavItem`.
- The auth-ui blocks and `emailAuthRoutes`, and the ui-models auth types.

## Effect on the plan

- **P3.3 has eight findings, not nine.** Upstream has already fixed the stub
  virus scanner.
- **P2.5 gains two required settings:** `VAULT_STORAGE_KEK` and `CLAMAV_HOST`.
- **No slice needs reordering.**
