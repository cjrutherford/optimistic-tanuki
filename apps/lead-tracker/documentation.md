# Lead Tracker Current Documentation

Status: current
Scope: `apps/lead-tracker` and `apps/leads-app`

## Purpose

Lead Tracker is the lead discovery and pipeline backend for Lead Command. It stores manual leads, creates and updates discovery topics, runs provider-backed discovery jobs, links discovered leads back to their topics, and reports dashboard metrics to the UI.

## Current User Flow

1. A new user lands on the Lead Command dashboard.
2. The dashboard onboarding opens as an interview instead of a raw topic form.
3. The user answers:
   - what service they sell
   - who buys it
   - what outcomes those buyers want
   - whether to search remote roles, local buyers, or both
   - where they are willing to work locally
   - what terms to avoid
4. The leads app generates the discovery topics automatically.
5. Lead Tracker immediately queues discovery for enabled topics.
6. The Topics page becomes the place to review and fine-tune the generated setup.

## Topic Generation Rules

The onboarding interview generates one or two topics:

- Remote role topic:
  - intent: `job-openings`
  - sources: `remoteok`, `himalayas`, `weworkremotely`, `justremote`, `jobicy`, `indeed`
  - keywords: normalized service + buyer + outcome phrases

- Local buyer topic:
  - intent: `service-buyers`
  - sources: `google-maps`, `clutch`, `crunchbase`
  - google maps cities: the local markets supplied by the user
  - google maps business types: derived from buyer phrases
  - keywords: normalized service + outcome phrases

## Data Model

`LeadTopic` currently supports:

- `name`
- `description`
- `keywords`
- `excludedTerms`
- `discoveryIntent`
- `sources`
- `googleMapsCities`
- `googleMapsTypes`
- `enabled`
- `lastRun`
- `leadCount`

This makes the topic model rich enough to support interview-driven onboarding without adding another onboarding-specific persistence layer.

## Discovery Behavior

Lead Tracker should requeue discovery when an enabled topic changes in ways that materially affect search results, including:

- `name`
- `description`
- `keywords`
- `excludedTerms`
- `discoveryIntent`
- `sources`
- `googleMapsCities`
- `googleMapsTypes`
- `enabled` from `false` to `true`

## UX Intent

The desired UX is:

- onboarding feels like a guided interview, not a configuration screen
- the user only needs to provide business context and local work radius
- source selection and search strategy are preconfigured
- the Topics page is for refinement, not first-run setup

## Known Constraints

- Google Maps local discovery only works well when buyer phrases can be converted into practical business categories.
- Provider availability and quality still vary by upstream site behavior.
- Discovery remains topic-driven; onboarding is a topic generator, not a separate search system.

## Canonical Files

- Dashboard onboarding: `apps/leads-app/src/app/dashboard.component.ts`
- Dashboard onboarding UI: `apps/leads-app/src/app/dashboard.component.html`
- Topics management UI: `apps/leads-app/src/app/topics.component.ts`
- Lead topic model: `libs/models/src/lib/libs/leads/lead-topic.model.ts`
- Lead topic controller logic: `apps/lead-tracker/src/app/leads.controller.ts`
- Lead topic persistence logic: `apps/lead-tracker/src/app/leads.service.ts`
