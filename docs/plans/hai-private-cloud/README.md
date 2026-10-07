# Hopeful Aspirations Industries — Website Private Cloud Agent Packet

This packet defines the website work required to add private-cloud marketing to `hopefulaspirationsindustries.com` without replacing the existing appliance, software-stack, cost-comparison, or custom-software positioning.

## Execution model

**One slice = one agent turn.**

The agent must complete only the current slice, validate it, update completion notes, and stop. It must not begin the next slice in the same turn.

## Governing documents

- `00-PROJECT-CHARTER.md`
- `01-CURRENT-STATE.md`
- `02-BRAND-AND-DESIGN-CONSTRAINTS.md`
- `03-INFORMATION-ARCHITECTURE.md`
- `04-CONTENT-AND-MESSAGING.md`
- `05-TECHNICAL-CONSTRAINTS.md`
- `06-SEO-ANALYTICS-ACCESSIBILITY.md`
- `07-ACCEPTANCE-CRITERIA.md`
- `08-SLICE-EXECUTION-POLICY.md`
- `09-DECISION-LOG.md`
- `10-DESIGN-SYSTEM-INVENTORY.md` (written in S001)
- `11-PRICING-ASSESSMENT.md` (pricing conflicts and open decisions)

## Slice status

| Slice | Description                       | Status   |
| ----- | --------------------------------- | -------- |
| S000  | Repository and site audit         | Complete |
| S001  | Design-system inventory           | Complete |
| S002  | Route and navigation foundation   | Complete |
| S003  | Homepage positioning              | Complete |
| S004  | Homepage private-cloud section    | Complete |
| S005  | Private-cloud landing page        | Complete |
| S006  | Home private-cloud page           | Complete |
| S007  | Organization private-cloud page   | Complete |
| S008  | Open-source stack page            | Complete |
| S009  | Turn-key appliance integration    | Complete |
| S010  | Software-stack integration        | Complete |
| S011  | Cost-comparison update            | Complete |
| S012  | Shared conversion components      | Complete |
| S013  | Assessment flow                   | Complete |
| S014  | Analytics and campaign tracking   | Complete |
| S015  | SEO and social metadata           | Complete |
| S016  | Responsive and accessibility QA   | Complete |
| S017  | Performance and browser QA        | Complete |
| S019  | QR and campaign validation        | Ready    |
| S020  | Theme and personality token audit | Planned  |
| S018  | Release pull request              | Planned  |

## Dependency order

`S000 → S001 → S002 → S003 → S004 → S005 → S006 → S007 → S008 → S009 → S010 → S011 → S012 → S013 → S014 → S015 → S016 → S017 → S019 → S020 → S018`

S018 runs last on purpose: the release PR carries the campaign URLs validated
in S019 and the token audit from S020 (added at the owner's request on
2026-10-07). The IDs were kept stable rather than renumbered.

## Standard launcher prompt

Use this at the start of each agent turn:

> Execute slice `SXXX` from `docs/plans/hai-private-cloud/slices/SXXX-....md`. Read all documents listed under Required References before changing code. Complete only this slice. Do not begin any future slice. Run the required validation and update the slice's Completion Notes before stopping.
