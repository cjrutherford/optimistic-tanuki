# Bug Reporting Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an unauthenticated-but-secure bug reporter: frontend lib captures screenshot + browser/backend logs, backend nonce-secured microservice emails single platform owner and opens a GitHub issue in a single central repo.

**Architecture:** New Angular lib `libs/bug-report` (screenshot + log buffer + submit client) calls new NestJS microservice `apps/bug-report` via `GET /api/bug-reports/nonce` then `POST /api/bug-reports` with single-use nonce; service validates nonce, redacts PII, sends email via existing `EmailService` and creates issue via Octokit. Gateway proxies `/api/bug-reports/*` to the new service.

**Tech Stack:** Angular 19 (lib), NestJS 11 + ThrottlerModule + class-validator, `html2canvas` (screenshot, inline base64 JPEG ~0.7 quality, max 1.5MB), Octokit `issues.create`, `EmailModule.forRootAsync`, Jest.

---

## Decisions (locked 2026-09-28)

- Owner: single platform owner from env `BUG_REPORT_OWNER_EMAIL` (no per-tenant lookup).
- GitHub: single central repo from env `BUG_REPORT_GITHUB_REPO` (`owner/repo`), token `BUG_REPORT_GITHUB_TOKEN`.
- Backend: new microservice `apps/bug-report` (billing-app pattern: `@nx/webpack:webpack` build + `@nx/js:node` serve), fronted by gateway proxy.
- Screenshot: inline base64 (`data:image/jpeg;base64,...`) embedded in email HTML + GitHub issue body/upload, no S3.

---

### Task 1: Scaffold contracts lib + backend app shell

**Files:**

- Create: `libs/bug-report/src/lib/bug-report.models.ts`
- Create: `apps/bug-report/project.json` (via generator), `apps/bug-report/src/main.ts`, `apps/bug-report/src/app/app.module.ts`
- Modify: `nx.json` / `tsconfig.base.json` paths (via generator)

**Step 1: Generate backend app shell (dry-run first)**

Run: `pnpm nx g @nx/nest:app bug-report --directory=apps/bug-report --dry-run`
Expected: Shows files to create, no writes.

**Step 2: Generate real app + frontend lib**

Run: `pnpm nx g @nx/nest:app bug-report --directory=apps/bug-report --unitTestRunner=jest --e2eTestRunner=none`
Run: `pnpm nx g @nx/angular:lib bug-report --directory=libs/bug-report --unitTestRunner=jest --prefix=lib`
Expected: `apps/bug-report/project.json`, `libs/bug-report/project.json` exist.

**Step 3: Define shared DTOs (copy into both, no cross-import to keep backend light)**

```typescript
// libs/bug-report/src/lib/bug-report.models.ts
export interface BugReportNonceResponse {
  nonce: string;
  expiresAt: string;
}
export interface BugReportPayload {
  nonce: string;
  description: string; // user text, max 5000
  pageUrl: string; // max 2000
  userAgent: string; // max 1000
  browserLogs: string[]; // max 200 entries, each max 2000 chars
  backendTraceIds: string[]; // x-request-id values seen, max 20
  screenshotDataUrl: string; // data:image/jpeg;base64,..., max ~2MB string
  occurredAt: string; // ISO
}
```

**Step 4: Run generators' tests pass**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report --skip-nx-cache`
Expected: PASS (empty suites ok).

**Step 5: Commit**

```bash
git add apps/bug-report libs/bug-report tsconfig.base.json nx.json
git commit -m "feat(bug-report): scaffold frontend lib and backend app shell"
```

---

### Task 2: Backend — nonce service (single-use, TTL, IP-bound)

**Files:**

- Create: `apps/bug-report/src/app/nonce/nonce.service.ts`
- Test: `apps/bug-report/src/app/nonce/nonce.service.spec.ts`
- Modify: `apps/bug-report/src/app/app.module.ts`

**Step 1: Write failing test**

```typescript
// nonce.service.spec.ts
describe('NonceService', () => {
  it('issues single-use nonce that expires', async () => {
    const svc = new NonceService();
    const { nonce } = await svc.issue('1.2.3.4');
    await expect(svc.consume(nonce, '1.2.3.4')).resolves.toBe(true);
    await expect(svc.consume(nonce, '1.2.3.4')).rejects.toThrow(/used|invalid/i);
  });
  it('rejects nonce from different IP', async () => {
    const svc = new NonceService(300_000);
    const { nonce } = await svc.issue('1.1.1.1');
    await expect(svc.consume(nonce, '2.2.2.2')).rejects.toThrow();
  });
});
```

**Step 2: Run to fail**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report --skip-nx-cache -t "NonceService"`
Expected: FAIL module not found.

**Step 3: Minimal implementation (Map + crypto, Redis-ready interface)**

```typescript
import { Injectable, BadRequestException } from '@nestjs/common';
import { randomBytes } from 'crypto';
@Injectable()
export class NonceService {
  private store = new Map<string, { ip: string; exp: number }>();
  constructor(private ttlMs = 5 * 60 * 1000) {}
  async issue(ip: string) {
    const nonce = randomBytes(32).toString('hex'); // 64 chars
    this.store.set(nonce, { ip, exp: Date.now() + this.ttlMs });
    return { nonce, expiresAt: new Date(Date.now() + this.ttlMs).toISOString() };
  }
  async consume(nonce: string, ip: string): Promise<true> {
    const rec = this.store.get(nonce);
    if (!rec) throw new BadRequestException('invalid nonce');
    this.store.delete(nonce); // single-use even on failure
    if (Date.now() > rec.exp) throw new BadRequestException('nonce expired');
    if (rec.ip !== ip) throw new BadRequestException('nonce ip mismatch');
    return true;
  }
}
```

**Step 4: Run pass**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report --skip-nx-cache -t "NonceService"`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/bug-report/src/app/nonce/
git commit -m "feat(bug-report): single-use TTL nonce store"
```

---

### Task 3: Backend — public nonce + submit controllers with throttling + validation

**Files:**

- Create: `apps/bug-report/src/app/reports/bug-report.controller.ts`, `bug-report.dto.ts`, `bug-report.service.ts`
- Modify: `apps/bug-report/src/app/app.module.ts`, `apps/bug-report/src/main.ts`
- Test: `apps/bug-report/src/app/reports/bug-report.controller.spec.ts`

**Step 1: Write failing DTO/controller test (unauth, throttled, size-limited)**

```typescript
// key assertions:
it('GET /api/bug-reports/nonce returns nonce without auth', ...);
it('POST without valid nonce → 400', ...);
it('POST rejects screenshot > 2MB and description > 5000', ...);
```

DTO:

```typescript
import { IsString, MaxLength, IsArray, ArrayMaxSize, IsISO8601, Matches } from 'class-validator';
export class SubmitBugReportDto {
  @IsString() @Matches(/^[a-f0-9]{64}$/) nonce!: string;
  @IsString() @MaxLength(5000) description!: string;
  @IsString() @MaxLength(2000) pageUrl!: string;
  @IsString() @MaxLength(1000) userAgent!: string;
  @IsArray() @ArrayMaxSize(200) browserLogs!: string[];
  @IsArray() @ArrayMaxSize(20) backendTraceIds!: string[];
  @IsString() @MaxLength(2_000_000) @Matches(/^data:image\/jpeg;base64,/) screenshotDataUrl!: string;
  @IsISO8601() occurredAt!: string;
}
```

Controller sketch:

```typescript
@Controller('api/bug-reports')
export class BugReportController {
  @Get('nonce') @Throttle({ default: { limit: 5, ttl: 60_000 } }) getNonce(@Ip() ip) { return this.nonce.issue(ip); }
  @Post() @Throttle({ default: { limit: 2, ttl: 60_000 } }) @UsePipes(new ValidationPipe({ whitelist: true })) submit(@Body() dto, @Ip() ip, @Headers('origin') origin) { ... }
}
```

`main.ts`: `app.useGlobalPipes`, `app.use(json({ limit: '3mb' }))`, enable CORS with `origin` allowlist from env, `ThrottlerModule.forRoot`.

**Step 2-4: Red-green (same nx test command as Task 2, `-t "BugReportController"`).**

**Step 5: Commit**

```bash
git add apps/bug-report/src/app/reports/ apps/bug-report/src/main.ts
git commit -m "feat(bug-report): public nonce and submit endpoints with throttling"
```

---

### Task 4: Backend — PII redaction + email to platform owner + GitHub issue

**Files:**

- Create: `apps/bug-report/src/app/reports/redact.util.ts`, `redact.util.spec.ts`, `github.service.ts`, `github.service.spec.ts`
- Modify: `apps/bug-report/src/app/reports/bug-report.service.ts`, `apps/bug-report/src/app/app.module.ts`

**Step 1: Failing tests**

```typescript
expect(redact('contact me at a@b.com token=abc123')).not.toContain('a@b.com');
expect(redact('Bearer eyJh...')).toContain('[REDACTED]');
```

**Step 2: Implement `redact()` (email, Bearer/JWT, `token=`/`api[_-]?key=` regexes, truncate each log to 2000 chars).**

**Step 3: `BugReportService.submit()` flow:**

1. `await nonce.consume(dto.nonce, ip)` + origin allowlist check (`BUG_REPORT_ALLOWED_ORIGINS` csv, else reject).
2. Redact description + logs.
3. `EmailService.sendEmail({ to: config.get('BUG_REPORT_OWNER_EMAIL'), subject: '[Bug] <pageUrl> <date>', html: template with description, meta table, <img src="screenshotDataUrl">, <pre>logs</pre> })`.
4. `GithubService.createIssue({ title: '[Bug] <first 80 chars of description>', body: markdown with meta + redacted logs (truncated to ~30KB for GitHub limits) + note screenshot inline, labels: ['bug','auto-reported'] })`.
5. Return `{ id, emailSent, issueUrl }`. Never leak token/owner email to client.

`GithubService` wraps `Octokit({ auth: BUG_REPORT_GITHUB_TOKEN })`, repo parsed from `BUG_REPORT_GITHUB_REPO`. Unit-test with mocked Octokit.

Env required: `BUG_REPORT_OWNER_EMAIL`, `BUG_REPORT_GITHUB_REPO`, `BUG_REPORT_GITHUB_TOKEN`, `BUG_REPORT_ALLOWED_ORIGINS`. Add to `apps/bug-report/src/config.ts` + `apps/bug-report/README.md`.

**Step 4: Run tests, verify.**

**Step 5: Commit**

```bash
git add apps/bug-report/src/app/reports/
git commit -m "feat(bug-report): redact PII, email owner and open github issue"
```

---

### Task 5: Frontend lib — log buffer + screenshot + submit client + button component

**Files:**

- Create: `libs/bug-report/src/lib/log-buffer.service.ts`, `screenshot.service.ts`, `bug-report.service.ts`, `bug-report-button/` component, `*.spec.ts`
- Modify: `libs/bug-report/src/index.ts`

**Step 1: Failing tests (patch console.\*, capture backend trace ids, compress screenshot)**

```typescript
// log-buffer.service.spec.ts: console.error('x') → buffer contains 'x', caps at 200
// screenshot.service.spec.ts: mocked html2canvas returns dataUrl, service downscales/compresses, rejects > 1.5MB
// bug-report.service.spec.ts: GET nonce → POST payload with HttpTestingController, no auth header
```

**Step 2: Implement:**

- `LogBufferService`: patches `console.log/warn/error` + `window.onerror` + `unhandledrejection`, ring buffer 200, each entry `${iso} [level] message`. Also `HttpInterceptor` capturing `x-request-id` response header into `backendTraceIds` (max 20). Provide `getSnapshot()`.
- `ScreenshotService`: dynamic `import('html2canvas')`, `canvas.toDataURL('image/jpeg', 0.7)`, downscale if `length > 1.5MB` (draw to smaller canvas), return `data:image/jpeg;base64,...`.
- `BugReportService`: `report(description)` → `GET /api/bug-reports/nonce` → gather `{pageUrl: location.href, userAgent: navigator.userAgent, browserLogs, backendTraceIds, screenshotDataUrl, occurredAt}` → `POST /api/bug-reports`. No auth headers. Timeout 30s.
- `BugReportButtonComponent`: floating button + dialog (textarea + submit), uses `common-ui` modal/button if available, else standalone. Emits success with issue confirmation (no owner email exposed).

**Step 3: Run**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx test bug-report --skip-nx-cache`
Expected: PASS.

**Step 4: Commit**

```bash
git add libs/bug-report/
git commit -m "feat(bug-report): frontend capture and submit client"
```

---

### Task 6: Wire-up — gateway proxy, env, e2e slice

**Files:**

- Modify: `apps/gateway/src/...` proxy (e.g. `controllers/bug-reports/bug-report-proxy.controller.ts` forwarding to `BUG_REPORT_SERVICE_URL`), or ingress route if gateway uses http-proxy.
- Modify: `apps/bug-report/README.md`, root `.env.example`, deployment manifests (Docker Compose service `bug-report`).
- Create: `apps/bug-report-e2e/` or extend `apps/client-interface-e2e` with `bug-report.spec.ts` (Playwright, system Chrome channel per repo guidance).

**Step 1: Gateway proxy test** — unauth `GET /api/bug-reports/nonce` returns 200 through gateway; `POST` with bad nonce returns 400 (no auth redirect).

**Step 2: Implement proxy** (NestJS `HttpModule` + `proxy` or `fetch` to `http://bug-report:3000`), preserve `x-forwarded-for` IP so nonce IP-binding works, enforce 3MB body limit.

**Step 3: E2E (live-stack mode, do not rebuild infra):**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false SKIP_SETUP=true pnpm nx e2e client-interface-e2e --skip-nx-cache -t "bug report"`
Expected: submit flow creates mocked email + mocked GitHub call (stub Octokit in test env via `BUG_REPORT_GITHUB_TOKEN=fake` + nock).

**Step 4: Validate smallest slice first, then affected suite. Confirm ports 8080/8081 up before live runs.**

**Step 5: Commit**

```bash
git add apps/gateway/ apps/*e2e/ .env.example
git commit -m "feat(bug-report): gateway proxy and e2e coverage"
```

---

## Security checklist (must verify before merge)

- Nonce 32 random bytes hex, 5-min TTL, single-use, IP-bound, consumed atomically.
- Throttle: 5 nonce/min, 2 submits/min per IP; 3MB JSON limit; screenshot ≤ ~2MB string, description ≤ 5000.
- Origin/Referer allowlist (`BUG_REPORT_ALLOWED_ORIGINS`); no auth cookies accepted on these routes; no owner email or token in responses.
- PII redaction before email/GitHub; GitHub body truncation to API limits; rate-limit GitHub failures without failing email path (report partial success).
- No secrets in frontend bundle; Octokit token server-only.

## Open follow-ups (out of scope for v1)

- S3-backed screenshot uploads if inline base64 proves too large.
- Per-tenant owner/repo overrides.
- Backend log fetch by trace-id (currently client only sends trace ids; server could query Loki/CloudWatch in v2).
