# Domain Email Templates Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Give every active application email a branded, email-client-safe HTML template derived from its sender's root domain, while preserving a readable plain-text alternative.

**Architecture:** Add a small renderer to `libs/email` that accepts a root domain, message content, optional action, and severity. The renderer resolves a domain theme with a deterministic root-domain fallback and emits table-based, escaped HTML. Authentication, Lead Tracker, and Setup Console will migrate their existing direct HTML/text messages to this renderer.

**Tech Stack:** TypeScript, NestJS, Jest, Nx, SMTP/Nodemailer.

---

### Task 1: Define and test the shared renderer

**Files:**

- Create: `libs/email/src/lib/templates/domain-email-template.ts`
- Create: `libs/email/src/lib/templates/domain-email-template.spec.ts`
- Modify: `libs/email/src/index.ts`

**Step 1:** Write renderer tests for root-domain normalization, a known domain theme, a root-domain fallback, escaped content, CTA/fallback URL, and a text alternative.

**Step 2:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test email --testPathPattern=domain-email-template` and confirm it fails because the renderer is absent.

**Step 3:** Implement a table-based renderer with inline styles, a small domain-theme registry, safe HTML escaping, and no external assets or JavaScript.

**Step 4:** Rerun the focused email test and confirm it passes.

### Task 2: Migrate authentication action and security notices

**Files:**

- Modify: `apps/authentication/src/app/email-auth.service.ts`
- Modify: `apps/authentication/src/app/app.service.ts`
- Modify: `apps/authentication/src/app/email-auth.service.spec.ts`
- Modify: `apps/authentication/src/app/app.service.spec.ts`

**Step 1:** Add failing assertions that action emails use their `uiBaseUrl` root-domain theme, carry a functional CTA, and preserve a plain-text URL.

**Step 2:** Run the focused authentication tests and confirm the new assertions fail.

**Step 3:** Render authentication action and MFA emails through the shared renderer; derive the identity from `uiBaseUrl` where available and use the configured sender domain for system notices.

**Step 4:** Rerun focused tests, then `pnpm nx test authentication`.

### Task 3: Migrate Lead Tracker and Setup Console emails

**Files:**

- Modify: `apps/lead-tracker/src/app/leads.service.ts`
- Modify: `apps/lead-tracker/src/app/leads.service.spec.ts`
- Modify: `apps/setup-console/src/server/setup.service.ts`
- Modify: `apps/setup-console/src/server/setup.service.spec.ts`

**Step 1:** Add failing assertions that outgoing lead replies and SMTP test messages include an HTML template, plain text, and identity resolved from the effective sender root domain.

**Step 2:** Run each focused test and confirm the expected failure.

**Step 3:** Replace the direct message construction with renderer calls without changing recipients, subjects, reply-to behavior, or delivery semantics.

**Step 4:** Rerun the focused tests, then each affected project test target.

### Task 4: Verify the integration

**Files:** all files above.

**Step 1:** Run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run-many -t test --projects=email,authentication,lead-tracker,setup-console`.

**Step 2:** Run `git diff --check` and inspect the final diff for unescaped interpolation or client-incompatible markup.

**Step 3:** Commit the renderer, sender migrations, and tests together after the commands pass.
