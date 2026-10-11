# Pricing Assessment

Written 2026-10-06 after the owner stated the intended model: **pass-through
pricing — customers pay hardware at cost plus labor, and the site says so
plainly.** The owner has not yet reviewed pricing in detail. This document
records every place pricing appears, how it conflicts with that model, and
the decisions needed. Nothing below has been changed in backend code.

## 1. The stated model conflicts with the implemented one

The Slice 11 commercial engine
(`docs/plans/2026-09-27-slice-11-bto-commercial-engine.md`, status in
`docs/audits/2026-09-28-slice-11-progress.md`) records owner decisions and
implements them in
`apps/system-configurator-api/src/hardware/commercial-pricing.ts` (used by
`commercial-quote.service.ts`):

| Slice 11 rule                                    | Pass-through model                         |
| ------------------------------------------------ | ------------------------------------------ |
| Customer hardware price = raw cost × 1.08 × 1.35 | Hardware at cost (no 1.35 markup)          |
| 10% sourcing reserve held inside the 35% markup  | No markup to hold it in                    |
| Leases amortized at 9.5% APR                     | Undecided: financing is not "at cost"      |
| 15% annual maintenance reserve                   | Undecided: labor, or not charged           |
| Retainers must clear a 70% margin floor          | Labor rate; margin floor contradicts model |
| Wholesale cost and margin never public           | Being upfront implies showing cost         |
| No static numbers presented as prices            | Same; firm prices come from quotes         |

The 1.08 factor is `FREIGHT_AND_TAX_RATE = 0.08`: a flat 8% allowance for
freight and tax, applied before the `PROCUREMENT_MARKUP_RATE = 0.35`. Freight
and tax are real costs and fit pass-through, but a flat allowance is an
estimate; passing them through exactly would mean billing the actual amounts.
Lease monthly totals are 9.5% APR amortization plus the 15% maintenance
reserve, both computed on the marked-up price.

## 2. What the public site actually shows

The gateway (`apps/gateway/src/controllers/hardware/hardware.controller.ts`,
`PRIVATE_TIER_FIELD`) strips every tier field whose name contains price,
cost, margin, lease monthly rate, wholesale, and similar before serving
`/api/hardware/tiers`. Fields that survive: `softwareMonthlyRate`,
`retainerMonthlyRate`, and the non-price fields.

The HAI site falls back to static tiers in
`apps/hai/src/app/services/hardware-catalog.service.ts` only when that API
call fails. So:

- **With the gateway up (production):** catalog prices render as bare `$`
  and `$/mo lease`; the cost calculator on `/cost-comparison` fails with "A
  valid hardware tier is required." This was already true before this
  project (the old template printed "Wholesale cost: $ with 35% margin").
  Verified 2026-10-06 by rendering both components with gateway-stripped
  tiers.
- **With the gateway down (local, or an outage):** the static fallback
  numbers appear, including wholesale cost and margin.

## 3. Every price on the site

| Where                                  | What it says                                                                                                                                                       | Problem under pass-through                                                                                                                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appliance catalog, purchase box        | Before S009 fix: "$705 package", "$2,850 to $3,200 setup", "$3,200 setup or $40,000 project build" (hard-coded per tier) plus "Wholesale cost: $X with 35% margin" | 35% markup shown as policy; numbers hard-coded, not sourced                                                                                                                                                   |
| Appliance catalog, lease box           | $99 / $199 / $349 per month                                                                                                                                        | 24 × $99 = $2,376 for $522 of hardware; cannot be "at cost"                                                                                                                                                   |
| Appliance catalog, service lines       | $50/mo software; $300–$500 and $849/mo retainers                                                                                                                   | Labor/support; fine if they are labor rates                                                                                                                                                                   |
| Industry stacks (`solutions-matrix`)   | Trade: $50/mo software + $99/mo lease; CPA: $3,200 setup + $550/mo; Legal: $2,850 setup + $650/mo; Builders: $3,200 setup + $849/mo or $40,000 project             | "Setup" figures are the marked-up hardware prices (CPA and Legal both use Tier 2, at the top and bottom of its $2,850–$3,200 range); the $550 and $650 retainers match no catalog tier ($300–$500 for Tier 2) |
| Cost calculator                        | Five-year totals from tier price × 1.1 contingency + monthly service                                                                                               | Built on the marked-up price; broken in production (section 2)                                                                                                                                                |
| Copy already pass-through              | "Hosting and hardware costs shown at cost" (services), "passed through at cost" (infrastructure, engagement)                                                       | Consistent with the owner's model                                                                                                                                                                             |
| Appliance Portal (system-configurator) | "Starting at $basePrice" per chassis; quotes from the Slice 11 formula                                                                                             | Separate app; carries the 1.35 markup into quotes                                                                                                                                                             |

Static figures also live in the backend tier seed
(`apps/system-configurator-api/src/app/hardware.service.ts`, the same
$522.22 / 35% / $705 values).

## 4. Interim change made in S009 follow-up (uncommitted)

Before this assessment, the catalog and calculator were changed to:

- show "Hardware at cost" with the static `wholesaleCost`, a "passed through
  with no markup; setup labor is quoted separately" line, and a pricing
  statement above the tiers;
- remove the hard-coded marked-up prices and the margin line;
- price the calculator's outright purchase from `wholesaleCost`, stating
  that setup labor is not included.

This states the owner's model, but it still shows **static, unsourced
numbers** as costs, which section 1 forbids, and it does not fix the
production gap in section 2. Leases, retainers, and the industry-stack
prices are unchanged. It should be kept, revised, or reverted once the
decisions below are made.

## 5. Decisions needed from the owner

1. **Markup.** Confirm pass-through replaces `× 1.35`. If yes, the Slice 11
   pricing functions, quotes, and the Appliance Portal need a separate
   change outside this marketing project.
2. **Freight and tax.** Keep the flat 8% allowance, or bill actual freight
   and tax as they occur.
3. **Labor.** Publish a rate (hourly or per job), or say "quoted after the
   audit". The site cannot be upfront about "cost plus labor" without one of
   these.
4. **Leases.** Keep (financing at what rate, stated how), or drop. Today's
   lease figures cannot be described as at cost.
5. **Retainers and software fees.** Confirm these are labor/support rates,
   and whether the 70% margin floor still applies.
6. **Public numbers.** Show hardware cost figures publicly (requires
   changing the gateway filter and sourcing them), or show the principle
   only and give figures in quotes.

## 6. Recommendation

Until 1–6 are settled, the public site should state the model and show **no
dollar figures it cannot source**:

- Catalog and industry stacks: keep specs and the pricing statement; replace
  dollar amounts with "Itemized quote: hardware at cost plus labor".
- Cost comparison (S011): make the neutral comparison qualitative
  (ownership, licensing, portability, control, support, expansion), and let
  the visitor enter their own hardware and labor estimates in the
  calculator rather than reading broken or static tier prices. This also
  fixes the production failure in section 2.

S011 is **Blocked** on decisions 3, 4, and 6.

## 7. Verification

- Formula constants read from `commercial-pricing.ts` on 2026-10-06.
- Production behaviour reproduced by rendering the catalog and calculator
  with tiers filtered by the gateway's own `PRIVATE_TIER_FIELD` pattern.
- Static figures compared across `hardware-catalog.service.ts`,
  `solutions-matrix.component.ts`, and the API tier seed.

## 8. Resolution (2026-10-06)

The owner answered section 5; the answers are D018–D022 in
`09-DECISION-LOG.md`. Applied to the public site:

- `apps/hai/src/app/content/pricing.ts` holds the model in one place:
  `LABOR_RATE_PER_HOUR = 65` (confirmed 2026-10-06) and the six
  pricing terms (hardware, freight and tax, labor, ongoing support, leasing,
  everything else).
- A shared "How we price" section (`hai-pricing-terms`) appears on
  `/turn-key-appliances`, `/software-stacks`, and `/cost-comparison`.
- The appliance catalog shows each tier's specs and the pricing structure,
  with no dollar figures except the labor rate. The industry stacks' fixed
  "commercial terms" were removed from the data, not just hidden.
- Lease prices and "bought outright or leased" wording are gone; leasing is
  "available on request through a third-party lender".
- The cost calculator no longer reads tier prices (which fixes the
  production failure in section 2). Visitors enter the hardware cost and
  hours from their quote; labor uses the published rate.
- `apps/hai/src/app/pricing-honesty.spec.ts` renders every page and fails if
  any dollar figure other than the labor rate appears.

### Proposed labor rate

| Step                                    | Per hour |
| --------------------------------------- | -------- |
| Technician pay (midpoint of $30–40)     | $35.00   |
| + self-employment tax (15.3%)           | $40.36   |
| ÷ 75% billable time                     | $53.81   |
| + ~20% overhead and HAI capital accrual | $64.57   |
| **Published rate**                      | **$65**  |

### Still open (outside the marketing site)

1. ~~Confirm the $65 rate~~ — confirmed 2026-10-06.
2. ~~Confirm "you see the receipts"~~ — confirmed 2026-10-06.
3. ~~Backend formula~~ — done 2026-10-06. `commercial-pricing.ts` now
   computes up front = hardware (supplier offers at cost) + actual freight +
   actual tax + setup hours × $65, and monthly = support hours × $65 +
   cloud, SMS, and network costs at actual amounts. The markup, flat 8%
   allowance, internal reserve, lease amortization, maintenance reserve, and
   70% retainer floor are gone. The quote request takes `freightAmount`,
   `taxAmount`, `setupHours`, and `monthlySupportHours` instead of
   `monthlyRetainerRevenue`; quotes are versioned `pass-through-v1`; the
   proposal itemizes hardware, freight, tax, and labor and states the
   receipts promise and leasing on request; the gateway passes the new
   totals to Lead Tracker; the Appliance Portal operator form takes hours,
   freight, and tax. Quote data is JSONB, so no migration was needed.
4. ~~Static tier seeds~~ — done. The old price fields were removed from the
   API tier seed and the HAI fallback tiers.
5. Find a leasing partner (D020).
