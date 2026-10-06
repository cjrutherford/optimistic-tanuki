# S002 — Route and Navigation Foundation

## Status

Ready

## Objective

Add a route for every offering in `03-INFORMATION-ARCHITECTURE.md`, move each
existing homepage section onto its route unchanged, and add the private-cloud
route hierarchy and navigation, without writing final page content (D011).

## Why this slice exists

Establish stable structure before content implementation.

## Dependencies

S001

## In scope

- /private-cloud
- /private-cloud/home
- /private-cloud/organizations
- /private-cloud/open-source-stack
- /private-cloud/assessment
- /turn-key-appliances, /software-stacks, /cost-comparison, /custom-software,
  /partners, /how-we-work, /contact, each hosting its existing section
  component(s) unchanged
- confirm with the owner where the independent-infrastructure section goes
- navigation updates (routes instead of hash anchors)

## Out of scope

- Final page copy
- Reducing the homepage to headlines (S003); the homepage keeps its sections
  until then so nothing disappears
- assessment form behavior
- analytics

## Required References

- ../03-INFORMATION-ARCHITECTURE.md
- ../05-TECHNICAL-CONSTRAINTS.md
- ../01-CURRENT-STATE.md
- ../10-DESIGN-SYSTEM-INVENTORY.md

## Implementation Requirements

- Use existing routing and navigation patterns.
- Safe placeholders are acceptable.
- Move the `--hai-*` tokens out of `.landing-shell` to a scope every route
  shares, so placeholder pages inherit them (`10-DESIGN-SYSTEM-INVENTORY.md`).

## Acceptance Criteria

- [ ] All routes resolve
- [ ] Every existing section is reachable on its own route
- [ ] Existing navigation still works
- [ ] Mobile nav still works

## Validation

- Run route tests/build/lint.

## Expected Files / Areas

- route config
- navigation component
- placeholder pages

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
