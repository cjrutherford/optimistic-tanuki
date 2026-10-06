# S013 — Assessment Flow

## Status

Planned

## Objective

Build `/private-cloud/assessment` and a working assessment request flow.

## Why this slice exists

The site needs a concrete conversion path.

## Dependencies

S012

## In scope

- form fields
- validation
- success state
- failure state
- spam protection compatible with current stack

## Out of scope

- CRM build-out
- complex quoting engine

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../05-TECHNICAL-CONSTRAINTS.md

## Implementation Requirements

- Use existing form/back-end pattern where available.

## Acceptance Criteria

- [ ] Form is accessible
- [ ] Validation works
- [ ] Submission path works
- [ ] Failure state is clear

## Validation

- Form tests/build and manual submission test in safe environment.

## Expected Files / Areas

- assessment page
- form handler/service

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
