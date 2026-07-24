---
title: OAuth and Email Verification Setup
summary: Configure login-only OAuth and verified transactional email for Optimistic Tanuki.
category: guides
section: guides
audience: operator
order: 29
tags:
  - oauth
  - authentication
  - email
  - smtp
---

# OAuth and Email Verification Setup

This is the operator guide for password registration, email verification, magic links, and login-only OAuth. It applies to local development, Docker Compose, and Kubernetes.

OAuth is handled by the gateway. Browser code starts a server-owned flow and never exchanges a provider authorization code or stores a provider access or refresh token. Email messages are delivered by the authentication service through SMTP (or logged by the console provider when SMTP is not configured).

## Before you start

Have these ready:

- a public HTTPS URL for `client-interface`; the default production configuration uses `https://optimistic-tanuki.com`
- OAuth client IDs and secrets for each provider to enable
- an SMTP relay and a verified sender address for real verification email
- a distinct, high-entropy `OAUTH_STATE_SECRET`; do not reuse `JWT_SECRET`
- a deploy-specific application registry with correct public `uiBaseUrl` values and `authEmail` settings

The gateway must be able to reach Redis. In production and staging, OAuth state and short-lived callback grants use Redis so the flow works across gateway replicas.

## How the flows work

### OAuth login

```text
browser -> GET /api/oauth/start/:provider -> provider
provider -> https://<client-interface>/oauth/callback/:provider
callback page -> gateway validates state and exchanges code server-side
gateway -> callback page with one-time callbackCode
callback page -> POST /api/oauth/callback/redeem -> application session
```

The callback page forwards the provider response to the gateway, removes callback parameters from browser history, and redeems a 60-second one-time code. The authorization code and provider tokens never become application API input or persistent database fields.

For account linking, the signed-in user starts `GET /api/oauth/link/:provider`. The authenticated gateway request, rather than client-supplied account data, determines which local account can be linked.

### Email verification and recovery

```text
browser -> POST /api/auth/email-action/request
authentication service -> SMTP relay -> user mailbox
user -> https://<registered-app>/auth/verify#token=...
browser -> POST /api/auth/email-verification/confirm
```

Verification, magic-link, and password-reset tokens are one-time, stored as hashes, and appear after `#` in the email URL so they are not sent in normal HTTP referrer or server logs. Verification and magic-link completion also create a session; password reset invalidates existing sessions.

| Purpose              | Request value    | UI path                | Lifetime   |
| -------------------- | ---------------- | ---------------------- | ---------- |
| Verify an email      | `verification`   | `/auth/verify`         | 24 hours   |
| Passwordless sign-in | `magic-link`     | `/auth/magic-link`     | 15 minutes |
| Password reset       | `password-reset` | `/auth/reset-password` | 30 minutes |

## Environment configuration

Copy `.env.sample` to a deploy-specific env file for Docker Compose, and copy `.secrets.example` to `.secrets` for the Kubernetes secret-generation script. Do not commit either populated file.

At minimum, set the following values:

```dotenv
JWT_SECRET=<long-random-secret>
OAUTH_STATE_SECRET=<different-long-random-secret>

# Keep false outside explicitly isolated development/test stacks.
AUTH_AUTO_VERIFY_EMAILS=false

SMTP_HOST=smtp.example.net
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mailer@example.com
SMTP_PASS=<smtp-password-or-app-password>
SMTP_FROM=Optimistic Tanuki <no-reply@example.com>
```

`OAUTH_STATE_SECRET` is mandatory whenever the gateway starts. It authenticates the browser-bound OAuth state; rotating it invalidates OAuth attempts that are in progress but does not invalidate ordinary application sessions. `AUTH_AUTO_VERIFY_EMAILS=true` is for the checked-in development stack only and must remain `false` in shared and production environments.

For each provider, set all three values together. Leaving a provider's client ID or secret blank disables that provider.

```dotenv
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://optimistic-tanuki.com/oauth/callback/google

GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=https://optimistic-tanuki.com/oauth/callback/github

MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_REDIRECT_URI=https://optimistic-tanuki.com/oauth/callback/microsoft

FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
FACEBOOK_REDIRECT_URI=https://optimistic-tanuki.com/oauth/callback/facebook
```

The redirect URI must exactly match the provider registration. If it is blank, the gateway derives it from `client-interface.uiBaseUrl` in the application registry. For local Docker development, the default client-interface URL is `http://localhost:8080`, so the Google callback, for example, is `http://localhost:8080/oauth/callback/google`.

## Register OAuth clients

Register a **Web** OAuth client for each provider. Use the public client-interface callback, not a gateway URL and not the old `/auth/callback/...` route.

| Provider  | Console                                                                                                                 | Required callback                                     | Requested scopes / permissions            |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------- |
| Google    | [Google Cloud Console](https://console.cloud.google.com/)                                                               | `https://<client-interface>/oauth/callback/google`    | `openid`, `email`, `profile`              |
| GitHub    | [GitHub OAuth Apps](https://github.com/settings/developers)                                                             | `https://<client-interface>/oauth/callback/github`    | `read:user`, `user:email`                 |
| Microsoft | [Microsoft Entra app registrations](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade) | `https://<client-interface>/oauth/callback/microsoft` | `openid`, `email`, `profile`, `User.Read` |
| Facebook  | [Meta for Developers](https://developers.facebook.com/)                                                                 | `https://<client-interface>/oauth/callback/facebook`  | `email`, `public_profile`                 |

Provider notes:

- Google: create an OAuth client of type **Web application** and add both local and production callback URLs if both are used.
- GitHub: create an OAuth App, set its homepage to the public client-interface URL, and set the authorization callback URL to the GitHub URI in the table.
- Microsoft: create a **Web** redirect URI, choose the intended account audience, and set `MICROSOFT_TENANT_ID` only if the configured provider metadata is customized for a tenant. The checked-in gateway metadata uses `common`.
- Facebook: add the URI under **Valid OAuth Redirect URIs** in Facebook Login settings, and make the app live before allowing non-test users.

After changing a provider console, deploy the matching ID, secret, and redirect URI together. Redirect URI mismatch errors almost always mean one of these values differs by scheme, host, path, or trailing slash.

## Configure email verification

### SMTP delivery

The authentication service selects SMTP when `SMTP_HOST` is non-empty. Otherwise it uses the console email provider, which logs messages and is appropriate only for local development.

Use port 465 with `SMTP_SECURE=true` for implicit TLS, or port 587 with `SMTP_SECURE=false` for STARTTLS when supported by the relay. Confirm that the relay accepts the `SMTP_FROM` domain and that SPF/DKIM/DMARC are configured for production sending.

### Application registry requirements

The gateway resolves the email sender and destination UI from the app registry. Each application that offers email actions needs an enabled `authEmail` block and a public `uiBaseUrl`, for example:

```json
{
  "appId": "client-interface",
  "name": "Optimistic Tanuki",
  "uiBaseUrl": "https://optimistic-tanuki.com",
  "authEmail": {
    "enabled": true,
    "from": "Optimistic Tanuki <no-reply@example.com>",
    "replyTo": "support@example.com"
  }
}
```

The configured sender must use an approved root domain. Do not point `uiBaseUrl` at an internal service URL: it is the link host placed in emails. The client application must include the auth-ui email action routes so `/auth/verify`, `/auth/magic-link`, and `/auth/reset-password` can consume the fragment token.

Email-action requests use the public gateway endpoint below. Include the registered application ID so the gateway can select the correct sender and UI URL:

```bash
curl -X POST https://<gateway>/api/auth/email-action/request \
  -H 'content-type: application/json' \
  -H 'x-ot-app-id: client-interface' \
  --data '{"email":"user@example.com","purpose":"verification","returnPath":"/"}'
```

This endpoint always returns an accepted response to avoid disclosing whether an address exists. Check SMTP delivery logs or the local console provider when diagnosing a missing message.

## Deployment

### Docker Compose

1. Copy `.env.sample` to a protected deploy env file and fill in the OAuth, SMTP, and secret values.
2. Set `APP_REGISTRY_HOST_PATH` to the deploy-specific application registry JSON.
3. Start the stack with its usual Compose command and env file.
4. Confirm the `gateway`, `authentication`, and `redis` services are healthy before testing a provider.

Docker Compose passes OAuth configuration only to the gateway and SMTP configuration to authentication. Keep provider secrets out of front-end build variables and browser configuration.

### Kubernetes

1. Copy `.secrets.example` to a local `.secrets`, fill in `OAUTH_STATE_SECRET`, SMTP values, and each enabled provider's credentials.
2. Run `bash scripts/generate-secrets.sh`. It creates `k8s/base/secrets.yaml` for common/authentication secrets and `k8s/base/gateway-oauth-secrets.yaml` for gateway-only provider credentials.
3. Apply both generated secret files and the normal Kustomize deployment. The gateway deployment requires `OAUTH_STATE_SECRET`; the authentication deployment reads SMTP values from `optimistic-tanuki-secrets`.
4. Mount or configure the production app registry so its public URLs and `authEmail` entries match the browser-facing domain.

Do not commit generated populated Secret manifests. Rotate an OAuth client secret by updating the relevant secret, restarting the gateway, and then revoking the old credential in the provider console after validation. Rotate SMTP credentials similarly and restart authentication.

## Validation checklist

1. Open the client-interface login screen and start each enabled provider.
2. Verify that the provider redirects to `https://<client-interface>/oauth/callback/<provider>`.
3. Complete login and confirm that the final browser URL does not contain a JWT, provider access token, refresh token, or authorization code.
4. Start two OAuth logins in separate tabs; both should complete. A callback replay or a callback without its browser cookie must fail generically.
5. Request verification email for a new address, open the link, and confirm the account can then use password login.
6. Request a magic link and password reset; verify that each link works once and expires on schedule.
7. In a production-like multi-replica environment, repeat an OAuth login while routing successive requests to different gateway pods.

## Troubleshooting

| Symptom                                                  | Likely cause                                                       | Action                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `OAuth state is not configured` or gateway fails startup | missing state secret                                               | Set a non-empty `OAUTH_STATE_SECRET` in the gateway environment/secret and restart.                                                              |
| Provider says redirect URI mismatch                      | URI is not byte-for-byte identical                                 | Compare the provider console URI to `*_REDIRECT_URI` or `client-interface.uiBaseUrl`, including `https`, port, path, and trailing slash.         |
| Provider button is unavailable                           | incomplete provider credentials                                    | Supply both client ID and client secret, then restart the gateway.                                                                               |
| Callback reports a generic failure                       | expired/replayed state, missing callback cookie, or provider error | Retry from the login screen; do not manually reuse a callback URL. Check gateway logs without logging codes or tokens.                           |
| Verification email is not received                       | SMTP delivery or registry sender setup                             | Confirm `SMTP_HOST`/credentials, the relay logs, and the app's enabled `authEmail.from`; inspect the console provider only in local development. |
| Verification link opens the wrong host                   | stale `uiBaseUrl` in registry                                      | Update the deploy-specific registry and redeploy/reload it.                                                                                      |
| OAuth login creates no usable session                    | email requires verification                                        | Ensure real SMTP/registry email configuration is present, then complete the verification link.                                                   |

## Security operating rules

- Use separate, randomly generated values for `JWT_SECRET` and `OAUTH_STATE_SECRET`.
- Register only HTTPS production callbacks; permit HTTP only for intentional localhost development.
- Keep provider credentials gateway-scoped and SMTP credentials authentication-scoped. Never put them in client code or application registry JSON.
- Keep `AUTH_AUTO_VERIFY_EMAILS=false` in shared and production environments.
- Treat provider and SMTP secrets as rotatable credentials; revoke/rotate immediately if exposed.
- Do not add a client-side token exchange or revive `POST /api/oauth/callback` / `POST /api/oauth/link`; those direct endpoints are retired in favor of server-owned start and link flows.

For provider-specific console steps, see [OAuth Provider Reference](./oauth-providers.md). For the general email plugin architecture and alternative providers, see [Email Provider Setup Guide](./email-providers.md).
