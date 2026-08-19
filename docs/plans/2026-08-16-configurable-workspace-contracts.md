# Configurable Manifest V1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a backwards-compatible, versioned plugin manifest to app configuration records and release snapshots, without changing current workspace ownership or authorization behavior.

**Architecture:** `app-config-models` owns a serializable manifest contract. `app-configurator` persists the optional JSONB manifest and preserves it through create, update, publish, and rollback. `workspace` identity, membership, and target authorization are explicitly deferred to tracker Slices 14–16 because the current configuration service has no tenant relation to enforce.

**Tech Stack:** TypeScript, NestJS, TypeORM/Postgres, Jest, Nx.

---

### Task 1: Define and export the versioned manifest contract

**Files:**

- Create: `libs/app-config-models/src/lib/configurable-plugin-manifest.model.ts`
- Modify: `libs/app-config-models/src/index.ts`
- Test: `libs/app-config-models/src/lib/config-document.model.spec.ts`

**Step 1: Write the failing test**

```ts
import { CONFIGURABLE_MANIFEST_VERSION, isConfigurablePluginManifest } from './configurable-plugin-manifest.model';

it('accepts manifest v1 and rejects unsupported versions', () => {
  expect(
    isConfigurablePluginManifest({
      schemaVersion: CONFIGURABLE_MANIFEST_VERSION,
      surfaceType: 'business-site',
      capabilities: {},
    })
  ).toBe(true);
  expect(
    isConfigurablePluginManifest({
      schemaVersion: 999,
      surfaceType: 'business-site',
      capabilities: {},
    })
  ).toBe(false);
});
```

**Step 2: Run the test and verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run app-config-models:test --testFile=libs/app-config-models/src/lib/config-document.model.spec.ts --runInBand`

Expected: FAIL because the module does not exist.

**Step 3: Implement the minimal contract**

```ts
export const CONFIGURABLE_MANIFEST_VERSION = 1 as const;

export type ConfigurableSurfaceType = 'business-site' | 'community' | 'generic';

export interface ConfigurableCapabilityManifest {
  enabled: boolean;
  placement?: string;
  permissions?: string[];
  settings?: Record<string, unknown>;
  resourceRef?: { type: string; id: string };
  deepLink?: { path: string; label?: string };
}

export interface ConfigurablePluginManifest {
  schemaVersion: number;
  surfaceType: ConfigurableSurfaceType;
  capabilities: Record<string, ConfigurableCapabilityManifest>;
}
```

Implement `isConfigurablePluginManifest()` as a runtime V1 validator for manifest and capability fields. Do not import domain types or replace the existing `features`/`routes` contracts.

**Step 4: Run the test and verify GREEN**

Run: same as Step 2.

Expected: PASS.

**Step 5: Commit**

```bash
git add libs/app-config-models/src/lib/configurable-plugin-manifest.model.ts libs/app-config-models/src/lib/config-document.model.spec.ts libs/app-config-models/src/index.ts
git commit -m "feat(config): add configurable plugin manifest contract"
```

### Task 2: Preserve the manifest through generic document conversion

**Files:**

- Modify: `libs/app-config-models/src/lib/app-configuration.model.ts`
- Modify: `libs/app-config-models/src/lib/config-document.model.spec.ts`

**Step 1: Write failing conversion tests**

Add a manifest fixture to `AppConfiguration`. Assert `appConfigToConfigDocument()` writes it under `metadata.appConfig.manifest`, and `configDocumentToAppConfig()` restores it. Keep a legacy fixture without a manifest and assert its result remains `undefined`.

**Step 2: Run the test and verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test app-config-models --runInBand --testPathPattern=config-document.model.spec.ts`

Expected: FAIL because conversion drops the manifest.

**Step 3: Implement the minimal pass-through**

Import `ConfigurablePluginManifest` and add optional `manifest?: ConfigurablePluginManifest` to `AppConfiguration`, `CreateAppConfigDto`, `UpdateAppConfigDto`, and `AppConfigurationSnapshot`. Include it in conversion metadata and restore it from metadata.

**Step 4: Run the test and verify GREEN**

Run: same as Step 2.

Expected: PASS, including old conversion tests.

**Step 5: Commit**

```bash
git add libs/app-config-models/src/lib/app-configuration.model.ts libs/app-config-models/src/lib/config-document.model.spec.ts
git commit -m "feat(config): preserve manifest in documents"
```

### Task 3: Persist, publish, and roll back the manifest

**Files:**

- Modify: `apps/app-configurator/src/configurations/entities/app-configuration.entity.ts`
- Modify: `apps/app-configurator/src/app/configurations.service.ts`
- Modify: `apps/app-configurator/src/app/configurations.service.spec.ts`
- Create: generated migration under `apps/app-configurator/migrations/`

**Step 1: Write failing service tests**

Add a manifest to create fixtures. Assert create stores it, a partial update preserves it, publish snapshots it, and rollback restores it.

**Step 2: Run the test and verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test app-configurator --runInBand --testPathPattern=configurations.service.spec.ts`

Expected: FAIL because the entity and snapshot omit `manifest`.

**Step 3: Implement and generate the migration**

Add nullable JSONB `manifest` to the entity. Map it explicitly in create and include it in `toSnapshot()` and rollback. Generate, never hand-create, the migration:

```bash
POSTGRES_DB=ot_app_configurator NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run app-configurator:typeorm:migration:generate --args='migrations/add-configurable-plugin-manifest'
```

Review the generated SQL: it must add only a nullable JSONB manifest column and use the CLI-generated 13-digit timestamp.

**Step 4: Run the focused tests and migration validation**

Run:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test app-configurator --runInBand --testPathPattern=configurations.service.spec.ts
pnpm run validate:typeorm-migrations
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/app-configurator/src/configurations/entities/app-configuration.entity.ts apps/app-configurator/src/app/configurations.service.ts apps/app-configurator/src/app/configurations.service.spec.ts apps/app-configurator/migrations
git commit -m "feat(config): persist plugin manifest"
```

### Task 4: Prove existing gateway command compatibility and document the deferral

**Files:**

- Modify: `apps/gateway/src/controllers/app-config/app-config.controller.spec.ts`
- Modify: `docs/services/app-configurator/architecture.md`
- Modify: `docs/reports/configurable-platform-program/index.html`

**Step 1: Write a gateway payload compatibility test**

Mock the client proxy. Call existing create/update controller methods with a DTO containing a v1 manifest; assert the identical manifest reaches the existing `AppConfigCommands.Create` and `AppConfigCommands.Update` payloads. Retain existing permission metadata assertions.

**Step 2: Run the test and verify RED**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test gateway --runInBand --testPathPattern=app-config.controller.spec.ts`

Expected: FAIL until the controller test setup supports the observable command payload.

**Step 3: Implement only testability/documentation support**

Do not add routes or loosen guards. Document that manifest persistence does not make app-config CRUD workspace-safe; workspace resolution, ownership filtering, target-scoped permission checks, and public-read policy belong to Slices 14–16.

**Step 4: Run targeted verification**

Run:

```bash
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test app-config-models --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test app-configurator --runInBand
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx test gateway --runInBand --testPathPattern=app-config.controller.spec.ts
pnpm run validate:typeorm-migrations
```

**Step 5: Commit**

```bash
git add apps/gateway/src/controllers/app-config/app-config.controller.spec.ts docs/services/app-configurator/architecture.md docs/reports/configurable-platform-program/index.html
git commit -m "docs(config): record manifest boundary"
```
