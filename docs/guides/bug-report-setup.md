---
title: Bug Report Setup Guide
summary: Configure the unauthenticated nonce-secured bug reporting chain — platform owner email, GitHub token and repo, allowed origins, and local verification.
category: guides
section: guides
audience: developer
featured: false
order: 35
tags:
  - bug-report
  - github
  - email
  - platform setup
---

# Bug Report Setup Guide

The bug reporting tool lets any visitor file a bug without signing in. The frontend library (`@optimistic-tanuki/bug-report-ui`) captures a screenshot plus recent browser logs, fetches a single-use nonce from the backend, and submits the report. The `bug-report` microservice then emails the single registered platform owner and opens an issue in a single central GitHub repo.

There is no authentication on these endpoints by design. Security comes from the nonce (32 random bytes, hex-encoded, 5-minute TTL, single-use, bound to the requester IP), per-IP throttling (5 nonces/min, 2 submits/min), an origin allowlist, a 3 MB body cap, and server-side PII redaction before anything is emailed or posted to GitHub.

Core wiring in this repo lives in:

- `libs/bug-report/src/lib/*` (screenshot, log buffer, submit client, report button)
- `apps/bug-report/src/app/nonce/*` (nonce issue/consume)
- `apps/bug-report/src/app/reports/*` (submit flow, redaction, email, GitHub)
- `apps/gateway/src/controllers/bug-report-proxy.controller.ts` (public gateway proxy)
- `docs/plans/2026-09-28-bug-reporting-tool.md` (implementation plan)

## Table of Contents

- [Environment Variable Reference](#environment-variable-reference)
- [GitHub Token Setup](#github-token-setup)
- [Platform Owner Email Setup](#platform-owner-email-setup)
- [Allowed Origins and Service URL](#allowed-origins-and-service-url)
- [Local Development](#local-development)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

---

## Environment Variable Reference

All values live in environment configuration (see `.env.sample`), never in code. The GitHub token and SMTP credentials are server-only secrets — they are never sent to the browser.

| Variable                                                        | Required     | Default                            | Purpose                                                                     |
| --------------------------------------------------------------- | ------------ | ---------------------------------- | --------------------------------------------------------------------------- |
| `BUG_REPORT_OWNER_EMAIL`                                        | Yes (prod)   | empty (email skipped with warning) | Single platform owner receiving bug emails                                  |
| `BUG_REPORT_GITHUB_REPO`                                        | Yes (prod)   | empty (issue creation skipped)     | Central repo as `owner/repo`                                                |
| `BUG_REPORT_GITHUB_TOKEN`                                       | Yes (prod)   | empty (issue creation skipped)     | Token with Issues read/write on the central repo                            |
| `BUG_REPORT_ALLOWED_ORIGINS`                                    | Recommended  | empty (any origin accepted)        | CSV of origins allowed to submit, e.g. `https://app.example.com`            |
| `BUG_REPORT_SERVICE_URL`                                        | gateway only | `http://localhost:3025`            | Where the gateway proxy forwards (`http://bug-report:3025` in compose)      |
| `BUG_REPORT_PORT`                                               | No           | `3025`                             | Listen port of the `bug-report` service                                     |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Yes (prod)   | empty (console provider)           | Real email delivery; see [Email Provider Setup Guide](./email-providers.md) |

If `BUG_REPORT_OWNER_EMAIL` is missing, the email step is skipped and logged; if the token or repo is missing, issue creation is skipped. The submit endpoint still returns `{ id, emailSent, issueUrl }` so the client never learns which halves are configured.

## GitHub Token Setup

Use a fine-grained personal access token scoped to just the central bug repo:

1. Open GitHub → profile photo → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Set an expiry (90 days or less) and a description such as `bug-report: open issues in <owner>/<repo>`.
3. Under **Repository access**, choose **Only select repositories** and pick the central bug repo.
4. Under **Repository permissions**, set **Issues** to **Read and write**. Leave everything else at **No access** (`Metadata` read-only is added automatically).
5. Generate the token and store it as `BUG_REPORT_GITHUB_TOKEN` in your secret manager / compose env. It starts with `github_pat_`.

For a public central repo, a classic token with the `public_repo` scope also works; for a private repo the classic token needs the full `repo` scope, which is broader than necessary — prefer the fine-grained token.

Verify the token without the app:

```bash
curl -sf -H "Authorization: Bearer $BUG_REPORT_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/<owner>/<repo> | head -c 300
```

Rotate by generating a replacement token, updating `BUG_REPORT_GITHUB_TOKEN`, restarting the `bug-report` service, then revoking the old token.

## Platform Owner Email Setup

Set `BUG_REPORT_OWNER_EMAIL` to the single registered owner address, and configure delivery exactly like any other transactional mail in this repo (see [Email Provider Setup Guide](./email-providers.md)):

- local development: leave `SMTP_HOST` empty to use the console provider (emails print to service logs).
- shared/production: verified SMTP relay or HTTP API provider with `SMTP_FROM` on a verified sender domain.

Report emails contain an inline screenshot (`data:image/jpeg` attachment rendered in HTML) plus redacted browser logs, the page URL, user agent, timestamp, and any backend `x-request-id` trace ids the client observed.

## Allowed Origins and Service URL

- `BUG_REPORT_ALLOWED_ORIGINS`: comma-separated origins enforced on submit (in addition to the service-level CORS allowlist). Example: `BUG_REPORT_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com`. Leave empty only in local dev.
- `BUG_REPORT_SERVICE_URL`: gateway-side pointer at the microservice. Local default `http://localhost:3025`; compose override `http://bug-report:3025` (already in `.env.sample`).
- The gateway preserves the client IP via `X-Forwarded-For` so nonce IP-binding survives the proxy. Do not put another unauthenticated proxy in front that strips it.

## Local Development

With everything unset, the chain degrades gracefully: nonce issuance works, PII redaction runs, the email prints to the service console log, and GitHub creation is skipped with a warning. To exercise the full path locally, set the four required values (`BUG_REPORT_OWNER_EMAIL`, `BUG_REPORT_GITHUB_REPO`, `BUG_REPORT_GITHUB_TOKEN`, plus SMTP or a local capture relay) and restart the `bug-report` service.

## Verification

Unit coverage (run before pushing):

```bash
export PATH="/tmp/ot-pnpm-bin:$PATH"  # if pnpm is not on PATH in this environment
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report --skip-nx-cache
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report-ui --skip-nx-cache
NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test gateway --skip-nx-cache -t "BugReportProxy"
```

End-to-end nonce flow against a running stack (gateway on `:3000`):

```bash
NONCE=$(curl -sf http://localhost:3000/api/bug-reports/nonce | python3 -c "import json,sys; print(json.load(sys.stdin)['nonce'])")
curl -sf http://localhost:3000/api/bug-reports -H 'Content-Type: application/json' -d "{
  \"nonce\": \"$NONCE\",
  \"description\": \"smoke probe\",
  \"pageUrl\": \"https://app.example.com/login\",
  \"userAgent\": \"smoke\",
  \"browserLogs\": [],
  \"backendTraceIds\": [],
  \"screenshotDataUrl\": \"data:image/jpeg;base64,/9j/\",
  \"occurredAt\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
}"
```

Reusing the same nonce must return `400`. The Playwright slice `apps/client-interface-e2e/src/bug-report.spec.ts` covers nonce issuance, invalid-nonce rejection, and report-button visibility on `/login` (run with `SKIP_SETUP=true` against the live stack).

## Troubleshooting

| Symptom                                 | Likely cause                                                                  | Fix                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `400 invalid nonce` on first submit     | Nonce issued for a different IP (proxy stripping `X-Forwarded-For`) or reused | Check gateway forwarding; fetch a fresh nonce per submit                                 |
| `400 nonce expired`                     | More than 5 minutes between dialog open and submit                            | Fetch the nonce at submit time (the client already does this)                            |
| `400 origin not allowed`                | `BUG_REPORT_ALLOWED_ORIGINS` set without the app origin                       | Add the origin to the CSV                                                                |
| `429 Too Many Requests`                 | Throttle tripped (5 nonce/min, 2 submits/min per IP)                          | Back off; check for loops double-submitting                                              |
| Email never arrives, `emailSent: false` | No SMTP configured or relay rejected                                          | Check service logs; verify `SMTP_*` per email guide                                      |
| `issueUrl: null`                        | Token/repo missing or API error                                               | Check service logs for `GitHub issue creation failed`; verify token scopes and repo name |
| Screenshot rejected (`422/400`)         | Data URL over ~2 MB or not JPEG                                               | Client auto-compresses; check for custom callers sending PNG                             |
