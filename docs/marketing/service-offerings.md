# Service Offerings

## Hosted Product Surfaces

Billing service is offered as a productized backend surface for teams that need usage metering, usage-block accounting, and invoice-preview orchestration without building the billing core from scratch.

## Delivery Posture

- hosted managed service: Optimistic Tanuki operates the billing backend for teams that want managed infrastructure
- self-hosted Docker: teams can also run the same service surface themselves when deployment control matters
- product language: describe the service as a managed billing capability, not only as an internal Nest microservice

## Pricing Model Vocabulary

- metered usage: pay for measured events, requests, or units consumed
- block usage subscription: recurring plan that grants a fixed usage block each billing period
- unlimited subscription: flat recurring price for bounded fair-use hosted access

## Current Productized Service

### Billing Service

- role: hosted usage metering, usage blocks, and invoice-preview backend surface
- default hosted posture: managed service for product teams and platform teams
- self-hosted posture: Docker deployment remains available for teams that need their own operational boundary
- current positioning: adopt hosted billing infrastructure now and preserve a self-hosted path later

## Scope Boundary

This documentation defines packaging and pricing posture only. It does not implement checkout, plan enforcement, quota accounting UX, invoice payment flow, or subscription state machines.
