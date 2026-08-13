# Fin Commander slices C and D — implementation plan

## Shared boundary

Existing Finance tenant membership remains the authorization source of truth. The
gateway `tenant/members` endpoints and Finance membership service are reused by
Slice D; this slice does not introduce a second tenant or role model.

## Slice C — directive execution bridge

1. Model an approved funding directive as a durable, tenant-scoped Finance
   record linked to a Fin Commander goal and its generated recurring item.
2. Preview the amount, cadence, start date, funding account, and non-ledger
   effect before approval. All money remains integer cents at the directive
   boundary.
3. On approval, create exactly one Finance recurring item, scoped to the same
   tenant and account. It forecasts a contribution only; it must not create a
   transaction, modify an account balance, or silently post a ledger entry.
4. Keep bidirectional links and cancel by deactivating the recurring
   instruction while retaining the directive/audit history.
5. Cover creation, idempotency, tenant scoping, and cancellation with focused
   service/controller tests.

## Slice D — in-app collaboration and tenant operator management

1. Turn the existing Fin Commander `members` route into a usable People and
   access screen, rather than creating a parallel owner-console membership
   surface.
2. Use the existing member APIs (`GET/POST/PUT/DELETE tenant/members`) and
   `finance.member.manage` authorization. Operator controls must not render for
   a non-operator and API denial remains authoritative.
3. Clearly distinguish active collaborators, their role, role changes, and
   revocation. Maintain tenant context in every request.
4. Extend the five-user Playwright matrix to prove same-tenant collaboration,
   role-specific management, revocation, and unrelated-tenant isolation.

## Integration and closeout

1. Integrate Slice C client approval UI after the backend contract settles.
2. Run focused tests first, then affected Nx lint/test/build and the live
   Chrome Playwright matrix using the Docker stack.
3. Update the audit artifact's Slice C, Slice D, completed-work, scorecard,
   remaining-slices, and guidance links at closeout; publish it on localhost,
   LAN, and Tailnet with no-cache responses.
