# Slice Execution Policy

## One slice per turn

Each implementation slice is intended to be completed in exactly one agent turn.

The agent must not begin another slice after completing the active slice.

## Start-of-slice protocol

1. Read `00-PROJECT-CHARTER.md`.
2. Read `02-BRAND-AND-DESIGN-CONSTRAINTS.md`.
3. Read `05-TECHNICAL-CONSTRAINTS.md`.
4. Read the active slice document.
5. Read every file listed under **Required References**.
6. Inspect the implementation relevant to the slice.
7. Verify dependencies are complete.

## End-of-slice protocol

1. Run the slice-specific validation.
2. Run relevant tests.
3. Run lint/typecheck where applicable.
4. Check responsive behavior if UI changed.
5. Check acceptance criteria.
6. Update `Completion Notes` in the slice.
7. Record changed files.
8. Record deviations or blockers.
9. Stop.

## Blocking rule

If an acceptance criterion cannot be met safely within scope:

- mark the slice `Blocked`,
- document why,
- stop.

Do not broaden scope into a later slice to compensate.

## Status vocabulary

- Planned
- Ready
- In Progress
- Blocked
- Complete
- Superseded
