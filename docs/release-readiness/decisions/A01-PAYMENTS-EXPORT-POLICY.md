# A01 — Payments export scope decision

**Accepted by the user on 2026-10-24: include own shared-account receipts.** This is the field/store policy for the existing O10 owner exposed during A01, not a new slice or product.

Towne Square creates account-bound donation and classified-payment records through Payments. Confirm/release/dispute actions update the shared payment; release also changes seller wallet balances and writes payment-owned ledger events. The current export job has no Payments capture participant. Several records and aggregate wallet totals do not retain a product-scope field, so a header on an export request cannot establish their original product attribution.

## Accepted policy

Include the authenticated account's own shared-service financial receipts and wallet totals. For a shared payment, emit only the account's matched buyer/seller participation, bounded monetary/status/time fields and an opaque transaction/context reference. Do not fetch or export counterpart profiles or authored content. Omit counterpart identities, credentials, provider tokens/order/subscription handles, bank/payment destination details, private proof images and dispute/moderator text. Preserve recorded-attribution uncertainty; matching a current account does not prove historical consent or ownership of another person's contribution.

Map every Payments source reached by TS, including its business/sponsorship/theme paths, through the same field-level inventory before implementation acceptance. Shared provider-product configuration is not automatically personal data. Payments-owned ledger events must be accounted for; the reviewed path does not establish a durable Finance mirror or Billing store.

## Rejected alternative (retained for decision context)

Include only records whose originating OT/TS scope can be independently proven. For legacy rows or aggregated wallet totals without that proof, report explicit uncovered coverage and block export completion. Do not silently infer a product scope or treat unprovable records as empty. This may require a separate provenance repair within the existing owner boundary.

## Implementation gate

The owner implementation and leased integration are now locally qualified in A01. The capture gate requires Payments as the twelfth owner; policy acceptance alone was not used to bypass it. Job artifacts remain unavailable until A02–A07 close. Neither option authorizes external provider access, changing transactions, erasing data or releasing incomplete artifacts. Implement and qualify the selected typed O10 capture and leased transport/job integration, then finish A01 and proceed to A02–A07 in order.
