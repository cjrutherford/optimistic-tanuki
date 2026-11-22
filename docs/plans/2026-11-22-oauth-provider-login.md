# Provider login regression and OAuth hardening

Split out of the owner console overhaul plan (branch `t3/owner-console-usability-audit`) so the two ship as separate PRs.

## What production does today

These were probed from outside on 2026-11-22.

- `GET /api/oauth/start/google` returns a 302 to Google on optimistic-tanuki.com,
  forgeofwill.com and hopefulaspirationsindustries.com. Each response has the
  correct `redirect_uri=https://<domain>/api/oauth/callback/google`, PKCE, and
  sets the `oauth_state_nonce` cookie (`Path=/api/oauth; Secure; SameSite=Lax`).
- `GET /api/oauth/config` returns 200. `GET /api/oauth/providers` returns 401,
  which is by design: it lists the providers linked to a signed-in user.

The first half of the flow, from the button to the provider, therefore works.
The failure is somewhere between the provider calling back and the session
being issued.

## Why the cause can't be seen

The callback handler (`oauth.controller.ts`, the `catch` after
`createCallbackGrant`) logs only `OAuth callback failed` and sends the browser
to `error=oauth_callback_failed`. More than ten steps can throw inside that
`try`, and they all end up looking the same.

## Candidates, ranked

Most of these were introduced by #283 (`f1a96856d`, 2026-10-27) and
`50854d5eb` (N02, 2026-10-23).

1. **A schema that wasn't migrated.** Every login now calls
   `AccountDeletionFenceService.assertActiveAccount`, which queries
   `account_deletion_operations` (migration `AccountDeletionControl1792886267140`).
   Rolling sessions read the columns added by `RollingSessionActivity1793105343107`.
   Migrations run only through `db-setup` or `OT_RUN_MIGRATIONS_ON_START=true`.
   If production was deployed without running `db-setup`, the query fails, and
   both password and provider login would break.
2. **Strict checks on the callback session** (N02). The gateway rejects the
   session unless `sessionId` is a UUID and `userId`, `profileId` and `appId`
   all match exactly. The authentication service also requires `appId` to
   match `^[a-z][a-z0-9_-]*$`. A start request with no `appScope`, or one with
   a scope that maps to a different canonical id, fails here.
3. **The callback-code exchange.** It needs the `oauth_state_nonce` cookie
   (scoped to `/api/oauth`) and an `Origin` that exactly equals the grant's
   `returnOrigin`. A `www.` origin against an apex origin, or a popup on another
   origin, fails with 401 "Invalid OAuth callback code".
4. **New sign-ups on client-interface and local-hub.** These now require an age
   check (`AGE_CHECK_REQUIRED`). This blocks first-time provider sign-ups only,
   not returning users.
5. **Guardian account access** (`guardianPermissionService.assertAccountAccess`
   inside `validateToken`). Accounts whose legacy age-eligibility backfill left
   them blocked would fail at the exchange.

## Evidence needed to pick one

- The URL or error the browser ends on after consent: `oauth_callback_failed`,
  `email_verification_required`, a provider page such as
  `redirect_uri_mismatch`, or a 401 from `/api/oauth/callback/exchange`.
- Whether email and password login works in production. If it fails too, the
  cause is #1.
- Gateway and authentication logs around one attempt.
- Which commit production runs, and whether `db-setup` ran after the last
  deploy.

## Fix plan

- **O1.** Log a step label in the callback `catch` (`state`, `token_exchange`,
  `login`, `register`, `profile`, `owner_access`, `callback_session`, `grant`)
  without the error content, so production shows which step failed. Do the same
  for the exchange's 401 branches.
- **O2.** Fix the step that fails, and add a regression spec for it.
- **O3.** Add a full provider-login e2e test using a stub OAuth provider, so a
  regression fails CI instead of production.
- **O4.** Owner console, System → OAuth health: surface admin-api's unused
  `oauth/validate` and `oauth/test`, the per-domain redirect URIs, and recent
  callback failures counted by step label. This belongs in slice S3 (health).

## Findings on production (2026-11-22, read-only over SSH)

- Production runs `sha-21291f1` (#298). All containers were recreated at
  about 03:10 UTC on 2026-11-22.
- **The Postgres cluster was created fresh at 2026-11-06 03:55 UTC.** Every
  database has that creation time, and the bind mount is `/opt/postgres_data`.
  `ot_authentication` contains 0 `user_entity` rows, 0 `oauth_provider` rows
  and 0 `token` rows. `ot_profile` contains 0 `profile` rows. Their
  `n_tup_ins` counters are all 0, so no insert has been attempted since then.
  Social (426 communities) and permissions (62 roles) hold seed data only.
- Each login attempt produces the same three log events:

  1. The gateway logs the start.
  2. About 10 seconds later, the authentication service logs one debug line,
     `OAuth login attempt`.
  3. 23 ms after that, the gateway logs an error.

  The authentication service never logs `Registering user`, and the profile
  service logs nothing.

- **What that means.** The authentication service finds no linked account
  and returns `needsRegistration`. The gateway then throws in the registration
  branch before it calls Register. That can only happen at one of these
  points:

  - **Owner console:** OAuth sign-up is refused in production by design. The
    owner account has to come from the deployment bootstrap, which has not
    run since the rebuild.
  - **client-interface and local-hub:** a new account needs an age check
    first, so these throw `AGE_CHECK_REQUIRED`.
  - **Any app:** `requireUsableOAuthEmail` throws if the provider returns no
    public email. GitHub does this when the user keeps their email private.

  The browser is shown the generic "OAuth authentication could not be
  completed" for all of these.

- **Logging regression (#283, `libs/logger/src/lib/payload-free-logging.ts`).**
  Every backend's logs become `{"event":"diagnostic.rejected"}`, and there is
  no way to switch it off. Production cannot record any operational detail.

## Revised fix plan

- **O0 (operations).** Confirm the 2026-11-06 rebuild was intended. Then run
  the owner bootstrap (`admin-api` `bootstrap/owner`) so an owner account
  exists.
- **O1.** Turn the internal failure codes into reasons the user can act on,
  passing an allow-listed `error` code to the callback page:

  - `age_check_required`: send the user to the age gate, then retry.
  - `owner_not_provisioned`
  - `provider_email_missing`

  Add an allow-list of safe event codes for the OAuth steps, so production
  logs show which step failed.

- **O1b.** Revisit the payload-free logger. Keep payloads out, but allow a
  per-module catalogue of event codes. Today every message is rejected, which
  hides every failure in production, not only OAuth.
- O2–O4 as above.

## Root cause and owner decisions (2026-11-22)

- **Root cause.** On the production host the env file spells the key
  `OWNER_BOOTSRAP_EMAIL`, with a T missing. `scripts/prod-seed.sh` therefore
  skips the owner bootstrap on every deploy, printing only a one-line echo, so
  the database has never held a user. The owner has fixed the key; it takes
  effect on the next deploy.
- **D-O1. Linking is explicit.** When a provider identity matches an existing
  local account by email, nothing is linked automatically, even when the
  provider has verified the email. The user sees a link step and has to prove
  they own the local account before the provider is attached.
- **D-O2. The age gate resumes instead of failing.** If OAuth sign-up on an
  age-gated app (client-interface, local-hub) arrives without an age check,
  the callback runs the age-verification step, including the guardian path
  where it applies, and then completes sign-up.
- **D-O3. Every failure has a name.** Each failure in the callback reaches
  the user as a specific, allow-listed code and a sentence they can act on.
  It is logged as a safe event code together with the step that failed. Deploy
  scripts fail loudly when the owner bootstrap is only partly configured.

## Contract: pending OAuth intents

Some callbacks cannot finish in one pass: they need a link confirmation or an
age check first. In those cases the gateway stores a **pending intent** in
Redis. The intent is single-use, expires after 10 minutes, is keyed by an
opaque 32-byte random id, and is bound to the `oauth_state_nonce` browser
cookie, using the same binding as the callback grant. It holds the provider
identity (provider, providerUserId, email, emailVerified, displayName), the
appScope, returnTo, cookieSession and the matched userId (link only). Nothing
from the provider token goes into it.

The callback redirects to the final callback URL with
`pending=<kind>&pendingCode=<id>&returnTo=…`, where `kind` is `link_account`
or `age_verification`. A link redirect also carries `email` (masked, for
example `j***@example.com`) and `provider`.

Gateway endpoints, all `@Public()`, need the nonce cookie and are rate
limited:

- `GET /api/oauth/pending/:code` returns `{ kind, provider, maskedEmail,
appScope, methods }` without consuming the intent. For a link intent,
  `methods` is `['password', 'email_code']` when the account has a password,
  otherwise `['email_code']` (a password hash may be a random placeholder, so
  the emailed code is always offered).
- `POST /api/oauth/pending/:code/link/email-code` sends a 6-digit code to the
  account email. It is used only when `methods` includes `email_code`.
- `POST /api/oauth/pending/:code/link` takes `{ password }` or
  `{ emailCode }`. The gateway verifies the credential through the
  authentication service, links the provider (`LinkProvider`), issues the
  callback session and grant, and returns `{ callbackCode, returnTo }`. A
  wrong credential returns `401 { error: 'link_credentials_invalid' }`, and
  the intent stays usable for up to 5 attempts. After that it is consumed and
  the response is `link_attempts_exhausted`.
- `POST /api/oauth/pending/:code/cancel` deletes the intent.
- `POST /api/oauth/pending/:code/age` takes `{ dateOfBirth }` or
  `{ guardianResumeToken }`. It runs the same age-eligibility evaluation as
  password sign-up. When the user is eligible, it registers the user and
  returns `{ callbackCode, returnTo }`, or `{ verificationRequired: true }`
  when email verification is still outstanding. If guardian consent is
  needed, it returns `{ error: 'guardian_consent_required', … }` with the same
  shape that password sign-up uses, so the existing guardian UI can take
  over. Signing up underage with no guardian returns `age_ineligible`.

In the authentication service, `OAuthLogin` no longer auto-links. When the
email matches an existing user, it returns `{ code: 1, data: { needsLink:
true, userId, hasPassword } }` and leaves the provider unlinked.

**Error codes.** The callback `error` value is always one of the following.
Each has a fixed `error_description` that the UI may override with its own
copy.

| Code                          | Meaning                                                                     |
| ----------------------------- | --------------------------------------------------------------------------- |
| `provider_denied`             | The user cancelled at the provider.                                         |
| `provider_exchange_failed`    | The code exchange or the profile fetch failed.                              |
| `provider_email_missing`      | The provider returned no usable email.                                      |
| `state_invalid`               | The state or nonce is missing, expired or mismatched.                       |
| `account_deleted`             | The account is behind the deletion fence.                                   |
| `registration_closed`         | The app refuses OAuth sign-up, for example the owner console in production. |
| `owner_not_provisioned`       | The owner console has no provisioned owner.                                 |
| `not_authorized_for_app`      | The user lacks access to the app, for example the owner console.            |
| `guardian_mismatch`           | The guardian permission belongs to another applicant.                       |
| `email_verification_required` | The address must be verified first (existing).                              |
| `session_issue_failed`        | Creating the session or grant failed.                                       |
| `profile_setup_failed`        | The app-scoped profile could not be created.                                |
| `oauth_callback_failed`       | Unexpected; also logs `oauth.callback.unexpected` with the step.            |

Each step in the callback sets a step label: `state`, `exchange`, `login`,
`register`, `profile`, `access`, `session` or `grant`. A failure logs
`oauth.callback.failed` together with `{ step, code }`, using only
allow-listed values, through a per-module event catalogue in
`libs/logger` (O1b).

## Follow-ups closed before merge (PR #299)

- **`owner_not_provisioned`.** The gateway sends this code when an
  owner-console sign-in is refused, or fails its access check, and no global
  profile exists yet. The signal is the same one that closes owner-console
  registration. If the check fails or times out after 3 seconds, the original
  code is reported instead.
- **Guardian return path.** `GUARDIAN_RETURN_PATHS` maps each age-gated app
  to its return path: client-interface and local-hub both use `/register`. An
  app missing from the map gets an error rather than a default. Only
  age-gated apps can create an `age_verification` intent or send a guardian
  email.
- **Account deletion.** Link intents are indexed per account in Redis, in the
  same Lua script as the fence check. Purge and invalidation remove them, and
  readback counts them. The private-Redis spec passes against a real Redis 7.
