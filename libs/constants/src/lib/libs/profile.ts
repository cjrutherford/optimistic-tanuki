// Canonical home is `@optimistic-tanuki/profile-contracts` (promoted per O3 —
// single source, no shape duplication). This file re-exports the original
// names for back-compat; new code imports from `profile-contracts`.
export {
  ProfileCommands,
  ProjectCommands,
  GoalCommands,
  TimelineCommands,
  PROFILE_ACCOUNT_EXPORT_CAPTURE_SOURCES,
} from '@optimistic-tanuki/profile-contracts';
// Authentication consumes this narrow internal contract through the shared
// boundary; keep its types canonical rather than duplicating RPC shapes.
export type {
  AccountProfileOwnershipRequest,
  AccountProfileOwnershipResult,
} from '@optimistic-tanuki/profile-contracts';
