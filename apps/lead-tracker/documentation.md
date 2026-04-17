# Lead Tracker Documentation

Status: current
Scope: `apps/lead-tracker` and `apps/leads-app`

## Purpose

Lead Tracker is the lead discovery and pipeline backend for Lead Command. It stores manual leads, creates and updates discovery topics, runs provider-backed discovery jobs, links discovered leads back to their topics, and reports dashboard metrics to the UI.

`leads-app` is the client surface for that workflow.

## Runtime Surface

In the current repo:

- `lead-tracker` is part of the Docker development stack
- `leads-app` is part of the Docker development stack
- both are included in the deployment inventory used by CI and k8s validation
- `lead-tracker` has a k8s base manifest
- `leads-app` has a k8s client manifest

Primary local endpoints:

- leads app: `http://localhost:4201`
- lead tracker service: `http://localhost:3020`
- gateway: `http://localhost:3000`

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

## Canonical Files

- Dashboard onboarding: `apps/leads-app/src/app/dashboard.component.ts`
- Dashboard onboarding UI: `apps/leads-app/src/app/dashboard.component.html`
- Topics management UI: `apps/leads-app/src/app/topics.component.ts`
- Lead topic model: `libs/models/src/lib/libs/leads/lead-topic.model.ts`
- Lead topic controller logic: `apps/lead-tracker/src/app/leads.controller.ts`
- Lead topic persistence logic: `apps/lead-tracker/src/app/leads.service.ts`
