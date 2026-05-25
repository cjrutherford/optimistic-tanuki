# leads-feature-onboarding Architecture

`leads-feature-onboarding` is the workflow-oriented client layer for the leads onboarding experience.

## Main Responsibilities

- analyze onboarding responses
- analyze mad-lib input
- parse resume uploads
- search candidate locations
- advance discovery interviews
- confirm onboarding outcomes

## Consumers

- `leads-app`

This library is the most orchestration-heavy leads client and should own the onboarding-specific HTTP surface.
