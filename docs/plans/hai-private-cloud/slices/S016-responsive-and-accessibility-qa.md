# S016 — Responsive and Accessibility QA

## Status

Planned

## Objective

Audit and fix responsive and accessibility issues across the private-cloud work.

## Why this slice exists

Accessibility and mobile behavior are release gates, not polish.

## Dependencies

S015

## In scope

- 375/430/768/1024/1440/1920 widths
- keyboard navigation
- focus
- contrast
- semantic headings
- forms
- alt text
- reduced motion

## Out of scope

- New features

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md
- ../07-ACCEPTANCE-CRITERIA.md

## Implementation Requirements

- Fix only issues discovered in this scope.

## Acceptance Criteria

- [ ] No overflow
- [ ] AA contrast
- [ ] keyboard usable
- [ ] forms labeled
- [ ] mobile nav works

## Validation

- Automated accessibility tooling if available plus manual checks.

## Expected Files / Areas

- all private-cloud pages
- navigation
- shared components

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
