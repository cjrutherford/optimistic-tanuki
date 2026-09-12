# Workspace Child-Scope Authorization Implementation Plan

> **For Codex:** Implement task-by-task with test-first verification in the current checkout (repository policy prohibits worktrees).

**Goal:** Use the canonical Workspace UUID to derive a tenant child scope and make it the common authorization and cache boundary for workspace-aware Gateway flows.

**Architecture:** Product app scopes remain platform namespaces. A resolved Workspace derives `workspace:<uuid>` as its tenant permission scope; the Gateway carries both the product scope and canonical workspace context. Existing target IDs remain compatibility inputs until all resource routes move to the child-scope contract.

**Tech Stack:** NestJS Gateway/Workspace services, TypeScript shared models/constants, Nx/Jest.

---

### Task 1: Shared child-scope contract

- Add `workspaceScopeId(workspaceId)` and validation in shared models.
- Test stable UUID-derived scope names and reject slugs/invalid IDs.

### Task 2: Gateway workspace context

- Extend the resolver with a context builder containing product app scope, Workspace record, and child scope ID.
- Test that context cannot be formed for a mismatched product app scope.

### Task 3: Permission cache and guard integration

- Add optional workspace scope to permission cache keys.
- Add an opt-in workspace requirement decorator/guard path that resolves canonical context before checking permissions.
- Test a cache entry cannot satisfy a request for another workspace.

### Task 4: Adopt high-value routes

- Start with business-site owner claim/config mutations and community owner mutations.
- Require matching workspace source ownership and child-scope capability checks.

### Task 5: Verify and track

- Run focused tests, affected Gateway/Workspace builds, and update Slice 16 evidence in the HTML tracker.
