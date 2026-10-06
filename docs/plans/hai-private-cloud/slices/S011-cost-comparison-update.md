# S011 — Cost-Comparison Update

## Status

Complete

## Objective

Add a neutral SaaS-vs-owned-private-cloud comparison.

## Why this slice exists

Cost/ownership comparison is commercially useful but must avoid misleading claims.

## Dependencies

S010

## In scope

- ownership
- licensing
- portability
- control
- support
- expansion

## Out of scope

- Claiming private cloud is always cheaper
- complex calculator

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../07-ACCEPTANCE-CRITERIA.md

## Implementation Requirements

- Work on the `/cost-comparison` route created in S002 (D011).
- Use neutral comparison language.

## Acceptance Criteria

- [x] No guaranteed-savings claims
- [x] Comparison is balanced
- [x] Links to assessment/private-cloud page

## Validation

- Build/test and copy review.

## Expected Files / Areas

- cost-comparison page

## Completion Notes

Completed 2026-10-06, after the pricing decisions D018–D022 unblocked it.

`/cost-comparison`, top to bottom:

1. **Visible intro:** "Subscriptions or ownership?", opening with "Owning
   your systems is not always cheaper." Start an assessment is the primary
   action.
2. **Side-by-side table** (`hai-comparison-table`): up-front cost,
   ownership, licensing, portability, control, support, and expansion, each
   with a fair statement for both a cloud subscription and an owned private
   cloud. It becomes labelled cards below 760 px.
3. **"A subscription is often the better choice when"**: small needs,
   provider-backed uptime, no space or power for hardware, preferring
   predictable monthly fees.
4. **Calculator, rebuilt** (`roi-calculator-section`,
   `roi-calculator.service`): visitors enter the hardware cost and setup
   hours from their quote, monthly support hours and service costs, and
   current subscription spend; labor uses `LABOR_RATE_PER_HOUR`. No HAI
   price is assumed, and the yearly-increase default is 0%. Results say
   "Owning costs $X less" or "Subscriptions cost $X less" and list what is
   not included (hardware replacement, electricity, internet, own time).
   Lease options and tier prices are gone.
5. **How we price** (`hai-pricing-terms`).
6. **Closing panel:** Start an assessment; secondary link to `/private-cloud`.

The calculator's "Send this comparison with my question" carries the result
to `/contact`. Browser testing showed the prefilled message never appeared in
the message box: the shared `lib-contact-form` patched its model but the
text area was unbound, and typing replaced the prefill. Fixed in
`libs/blogging-ui` by binding the text area to the message `FormControl`,
with DOM-level tests (the new test fails on the old binding). This affected
the homepage before S003 as well.

The pricing work that preceded this slice (catalog, industry stacks, shared
pricing section, honesty guard) is recorded in `../11-PRICING-ASSESSMENT.md`
section 8.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 178 tests. New or rewritten: calculator service
  (hand-calculated five-year case, both outcome directions, compounding,
  assumptions, validation), calculator component (no assumed prices, no
  leases, labor rate, neutral outcomes, omissions, errors, emitted message),
  cost-comparison page (topics, balance, no savings claims, links, pricing,
  contact hand-off), pricing terms, and the site-wide `pricing-honesty` and
  `cta-conventions` guards now covering this page.
- `nx test blogging-ui` (240), `christopherrutherford-net` (37),
  `digital-homestead` (158): pass after the shared contact form fix.
- `nx lint hai`, `nx lint blogging-ui`, `tsc`, `nx build hai`: pass. Initial
  total 838.82 kB (down 8 kB; the calculator no longer loads the catalog).
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark, on `/cost-comparison`, `/turn-key-appliances`, and
  `/software-stacks`: no overflow, no page errors, and `$65` is the only
  dollar figure on any of them before the visitor enters numbers. A full
  calculator run produced the expected totals and the comparison arrived in
  the contact message box.

Changed files:

- `apps/hai/src/app/pages/cost-comparison/` (page and spec)
- `apps/hai/src/app/components/cost-comparison/comparison-table.component.{ts,html,scss}` (new)
- `apps/hai/src/app/components/landing/roi-calculator-section.component{,.spec}.ts`
- `apps/hai/src/app/services/roi-calculator.service{,.spec}.ts`
- `apps/hai/src/app/content/cost-comparison.ts` (new)
- `apps/hai/src/app/pages/offering-pages.spec.ts`,
  `apps/hai/src/app/pricing-honesty.spec.ts`,
  `apps/hai/src/app/cta-conventions.spec.ts`
- `libs/blogging-ui/src/lib/contact-form/contact-form.component.{ts,html,spec.ts}`
- `docs/plans/hai-private-cloud/README.md`, `11-PRICING-ASSESSMENT.md`, this
  slice

## Deviations / Blockers

- The calculator keeps its older, narrower centred layout and type, which
  differ from the section styles around it; moving it onto
  `styles/_section.scss` belongs to S012.
- Was **blocked 2026-10-06** on pricing decisions 3 (labor), 4 (leases), and 6
  (public numbers) in `../11-PRICING-ASSESSMENT.md`. The existing calculator
  also fails in production because the gateway strips the tier prices it
  reads (assessment section 2); a neutral comparison cannot be built on it
  until the owner decides how pricing is shown.
