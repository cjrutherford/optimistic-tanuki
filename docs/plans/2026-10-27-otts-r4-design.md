# OT/TS R4 verification

Execute existing R4-01 through R4-05 in order. Scope is `client-interface`,
`local-hub` and the shared owners they reach. Keep the existing IDs and release
denominator. Preserve prior receipts as revision snapshots and the protected
Directory/Compose/TypeScript edits.

Use the existing disposable twelve-database/process fixture, extended with the
actual Gateway controllers used by these journeys. Its previous account-controls
mode stays separate. No successful owner handlers or permission checks are
replaced. Synthetic identities and verified sessions are fixture inputs;
external OAuth/email/provider execution remains X01–X04.

R4-01 covers same-app restoration, account A/B switching, owned secondary and
foreign/wrong-scope profile selection, stale credentials and delayed UI state.
R4-02 covers locality/community reads and owner/member/nonmember actions, plus
recoverable local failure. R4-03 covers classified buyer/seller state and local
payment failures without promising a live provider. R4-04 checks keyboard,
focus, announcements and responsive controls on the exercised pages. R4-05
checks failed upload retry, deep-link reload, interrupted transport and socket
reconnect, with independent write counts and authorization after revocation.

Prefer fixes in shared services/components. Run the narrow regression for each
change, then the coupled real-browser/runtime case. Record any unexecuted or
external boundary instead of treating source/unit evidence as acceptance. Only
a passing slice reduces the remaining count.

Implementation findings: both offer dialogs now use the shared modal. Shared
buttons derive readable tone text for restored pastel themes. Seller acceptance
states that the card record is pending/unprocessed. Manual card confirmation
through the offline endpoint is refused. Payments preserves typed authorization/
state denials across RPC; Assets preserves retryable scanner unavailability.
The private upload test uses the real ClamAV engine with a declared one-signature
test database and EICAR positive control; production definitions remain unqualified.
See `docs/operators/ot-ts-journeys.md` for the fixture and its exact boundaries.

The R4-03 safety boundary also rejects non-finite, non-positive, overflowing and
negative-proceeds offer/payment amounts before persistence. The private R4
composition starts the production Assets internal media HTTP route for actual
member readback; authorization remains at the real Gateway and owner boundaries.
