# Towne Square

![category](https://img.shields.io/badge/category-community-2ec27e?style=flat-square)
![personality](https://img.shields.io/badge/personality-soft--touch-ffb454?style=flat-square)
![project](https://img.shields.io/badge/project-local--hub-6c7ce0?style=flat-square)
![maturity](https://img.shields.io/badge/maturity-early%20access-8a6fdf?style=flat-square)

Towne Square is the public-facing name for the `local-hub` product. Its positioning centers on locality: people can be connected to a place through living nearby, work, visits, school, volunteering, or other ties. RR-01 treats locality positioning as `VERIFY`; the current landing describes local browsing and exchange as early access. This internal one-pager is not approved launch copy while RR-12 remains unaccepted.

## Visual Identity

| Attribute           | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| Default personality | `soft-touch` — organic, warm, gentle, pill-shaped surfaces                            |
| Why                 | Reinforces a community-feeling product where neighbors meet, trade, and coordinate.   |
| Typography          | Quicksand headings, Nunito body                                                       |
| Borders & shadows   | Pill radius, soft glow                                                                |
| Animation           | Slow, flowing                                                                         |
| Catalog reference   | [`docs/design-system/personalities.md`](../design-system/personalities.md#soft-touch) |

## Audience

- residents who want one place for local information and exchange
- local organizers exploring ways to help people coordinate
- community builders supporting neighborhood-scale participation
- operators who want a deployable local platform instead of disconnected community tools

## Promise

Help people explore local information and exchange. Keep the product description tied to the specific workflows accepted by RR-06 and the reviewed RR-12 revision.

## Workflow

1. Browse supported localities and communities.
2. Explore classifieds and messaging in early access.
3. Describe civic information as product direction only; do not imply a released civic feed or Daylight until RR-07 accepts it.

## Proof

- city and community browsing flows
- locality and community browsing source paths
- classifieds and messaging source paths, both subject to RR-06/10 acceptance
- local-hub tests and deployment configuration as evidence inputs, not launch acceptance by themselves

## Deployment Posture

The repository contains a `local-hub` Angular SSR app and deployment configuration. Confirm support and exact reviewed revision before describing a deployment as available to users.

## Call To Action

Internal CTA draft: invite people with ties to a supported place to explore its early-access local workflows. Do not promise invitation delivery; the reviewed invitation flow is broken and has not passed end-to-end delivery acceptance. Do not imply donations, sponsorships, paid business features, reputation-based moderation, or released civic-feed behavior.
