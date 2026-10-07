# S013 — Assessment Flow

## Status

Complete

## Objective

Build `/private-cloud/assessment` and a working assessment request flow.

## Why this slice exists

The site needs a concrete conversion path.

## Dependencies

S012

## In scope

- form fields
- validation
- success state
- failure state
- spam protection compatible with current stack

## Out of scope

- CRM build-out
- complex quoting engine

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../05-TECHNICAL-CONSTRAINTS.md

## Implementation Requirements

- Use existing form/back-end pattern where available.

## Acceptance Criteria

- [x] Form is accessible
- [x] Validation works
- [x] Submission path works
- [x] Failure state is clear

## Validation

- Form tests/build and manual submission test in safe environment.

## Expected Files / Areas

- assessment page
- form handler/service

## Completion Notes

Completed 2026-10-07.

`/private-cloud/assessment` replaces its placeholder (the placeholder page
component, now unused, was removed):

- **Page:** intro ("A few questions… no obligation"), "What happens next"
  (reply by email, itemized quote at actual cost plus labor hours, nothing
  ordered until you say yes), and the form.
- **Form** (`components/assessment/assessment-form`, reactive forms): who
  it's for (home or organization; organization name appears for
  organizations), name, email, optional phone, how many people, what to keep
  (checkboxes), roughly how much (radios, including "Not sure"), current
  subscriptions, and notes.
- **Validation:** required answers, email format, phone characters, length
  limits matching the server DTO. A failed submit shows an error summary
  (`role="alert"`) that receives focus; each item links to and focuses its
  field; fields get `aria-invalid` and `aria-describedby` to their message.
- **Submission path:** the existing public contact intake (`POST
/api/contact`), the same path the contact form uses, so no backend change.
  `AssessmentRequestService` sends name, email, phone, company, subject
  "Private cloud assessment (home|organization)", a readable message built
  by `buildAssessmentMessage`, `appScope: 'hai'`, and the source page and
  label. Double submits are ignored while sending.
- **Spam protection:** the server's existing `website` honeypot, as an
  off-screen field hidden from assistive technology and out of the tab
  order.
- **Success:** the form is replaced by a confirmation whose heading receives
  focus. **Failure:** an alert that receives focus, keeps every answer, and
  offers the phone number and email.

Manual submission test in a safe environment: the production build ran
against a local stub gateway that recorded `/api/contact` requests and could
be switched to fail. With the stub returning 500, the failure alert appeared,
took focus, and the answers stayed; switching to 201 and resubmitting showed
the confirmation with focus on its heading. Both recorded payloads matched
the expected fields with an empty honeypot. No real inbox or lead store was
touched.

Fixed during testing: focus stayed on the button after an empty submit (the
summary rendered after the focus call; now uses `afterNextRender`), and each
radio was its own tab stop (radios lacked `name`; now one stop per group).

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 200 tests. New: message builder, request service
  (payload, optional fields, honeypot, failure, no double submit), form
  (labels and legends, radio grouping, error summary and ARIA, email and
  phone validation, organization field, submission, trap hidden, sending,
  success, failure), page; the CTA-convention and honest-pricing guards
  now cover this page.
- `nx lint hai`, `tsc`, `nx build hai`: pass. Initial total 855.70 kB
  (+12 kB; noted for S017).
- axe-core (WCAG 2.0/2.1 A and AA) on the form, empty and with errors
  showing: no violations. Keyboard: every control reachable in order; the
  trap is not.
- Overflow sweep at 375, 430, 768, 1024, 1440, 1920 px, light and dark, with
  errors showing: no overflow, no page errors.

## Deviations / Blockers

- Delivery to a real inbox and Lead Tracker was not exercised (by design,
  to avoid creating test leads); it uses the same intake as the contact
  form. Worth one real submission when you deploy.
- The hint under "What do you pay…" originally gave "$40 a month" as an
  example; the honest-pricing guard flagged it and it was reworded.
