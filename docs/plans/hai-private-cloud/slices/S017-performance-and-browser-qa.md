# S017 — Performance and Browser QA

## Status

Planned

## Objective

Validate and optimize performance and browser compatibility.

## Why this slice exists

Heavy marketing imagery must not undermine the site experience.

## Dependencies

S016

## In scope

- image optimization
- lazy loading
- LCP/CLS/INP
- Chrome
- Firefox
- Safari if available
- mobile Chromium

## Out of scope

- New features
- visual redesign

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md

## Implementation Requirements

- Do not ship print-resolution assets directly.

## Acceptance Criteria

- [ ] Performance is acceptable
- [ ] No major browser regressions
- [ ] Images optimized

## Validation

- Performance audit/build/browser smoke tests.

## Expected Files / Areas

- image assets
- page loading
- shared layout

## Completion Notes

_To be filled by the implementing agent._

## Deviations / Blockers

_None unless documented by the implementing agent._
