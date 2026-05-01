# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: user-journey.spec.ts >> Fin Commander user journey >> supports fresh-user registration, login, profile update, and personal finance CRUD
- Location: apps/fin-commander-e2e/src/user-journey.spec.ts:865:7

# Error details

```
Error: Console errors:
ERROR rt ["<unserializable>","<unserializable>"]

expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "ERROR rt [\"<unserializable>\",\"<unserializable>\"]",
+ ]
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e10]:
      - img "App Logo" [ref=e11]
      - generic [ref=e12]: Fin Commander
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: ☀
          - generic [ref=e18]:
            - checkbox "️"
            - generic [ref=e19] [cursor=pointer]: ️
          - generic [ref=e20]: 🌙
        - textbox [ref=e22] [cursor=pointer]: "#0d5f73"
        - button "Select personality" [ref=e24] [cursor=pointer]:
          - generic [ref=e25]: Classic
          - generic [ref=e26]: ⚙
      - button "☰" [ref=e28] [cursor=pointer]
    - generic [ref=e29]:
      - generic [ref=e31]:
        - generic [ref=e32]: Account
        - strong [ref=e33]: Personal Command
      - generic [ref=e34]:
        - generic "Active account selector" [ref=e37]:
          - generic [ref=e38]: Account
          - combobox "Account" [ref=e39]:
            - option "Personal Command (Individual)" [selected]
          - button "New account" [ref=e40] [cursor=pointer]
        - generic "Finance profile selector" [ref=e42]:
          - generic [ref=e43]: Profile
          - combobox "Profile" [ref=e44]:
            - option "Fin Commander Updated" [selected]
        - button "Help" [ref=e45] [cursor=pointer]:
          - generic [ref=e46]: "?"
  - generic [ref=e48]:
    - generic [ref=e49]:
      - generic [ref=e50]:
        - paragraph [ref=e51]: Finance Workspace
        - heading "Finance Workspace" [level=1] [ref=e52]
        - paragraph [ref=e53]: Track and manage your finances.
      - generic [ref=e54]:
        - heading "Setup Progress" [level=2] [ref=e55]
        - paragraph [ref=e56]: 3/4 steps complete
        - link "Review setup" [ref=e57] [cursor=pointer]:
          - /url: /onboarding
    - navigation "Workspace sections" [ref=e58]:
      - link "Overview" [ref=e59] [cursor=pointer]:
        - /url: /finance/personal
      - link "Setup" [ref=e60] [cursor=pointer]:
        - /url: /finance/personal/setup
      - link "Accounts" [ref=e61] [cursor=pointer]:
        - /url: /finance/personal/accounts
      - link "Transactions" [ref=e62] [cursor=pointer]:
        - /url: /finance/personal/transactions
      - link "Budgets" [ref=e63] [cursor=pointer]:
        - /url: /finance/personal/budgets
      - link "Recurring" [ref=e64] [cursor=pointer]:
        - /url: /finance/personal/recurring
    - generic [ref=e66]:
      - generic [ref=e67]:
        - paragraph [ref=e68]: Plan
        - heading "Recurring Items" [level=1] [ref=e69]
      - generic [ref=e70]:
        - textbox "Name" [ref=e71]
        - spinbutton [ref=e72]: "0"
        - combobox [ref=e73]:
          - option "Debit" [selected]
          - option "Credit"
        - textbox "Category" [ref=e74]
        - combobox [ref=e75]:
          - option "Weekly"
          - option "Monthly" [selected]
          - option "Quarterly"
          - option "Yearly"
        - textbox [ref=e76]: 2026-05-01
        - button "Create item" [ref=e77] [cursor=pointer]
  - button "Open about HAI" [ref=e79] [cursor=pointer]:
    - generic [ref=e81]: HAI
    - generic [ref=e82]:
      - strong [ref=e83]: Fin Commander
      - generic [ref=e84]: About this app
```

# Test source

```ts
  172 |                     }
  173 | 
  174 |                     return summary;
  175 |                   };
  176 | 
  177 |                   if (value instanceof Error) {
  178 |                     return {
  179 |                       name: value.name,
  180 |                       message: value.message,
  181 |                       stack: value.stack,
  182 |                     };
  183 |                   }
  184 | 
  185 |                   if (typeof value === 'object' && value !== null) {
  186 |                     return summarizeObject(value as Record<string, unknown>);
  187 |                   }
  188 | 
  189 |                   return value;
  190 |                 });
  191 |               } catch {
  192 |                 return '<unserializable>';
  193 |               }
  194 |             })
  195 |           );
  196 |           text = `${text} ${JSON.stringify(values)}`;
  197 |         } catch {
  198 |           // Keep the original text when console arguments cannot be resolved.
  199 |         }
  200 |       }
  201 |       if (
  202 |         text ===
  203 |         'Failed to load resource: the server responded with a status of 404 (Not Found)'
  204 |       ) {
  205 |         return;
  206 |       }
  207 |       if (text === 'ERROR HttpErrorResponse ["ERROR","<unserializable>"]') {
  208 |         return;
  209 |       }
  210 |       const location = message.location();
  211 |       if (location.url) {
  212 |         text = `${text} @ ${location.url}:${location.lineNumber}:${location.columnNumber}`;
  213 |       }
  214 |       diagnostics.consoleErrors.push(text);
  215 |     }
  216 |   });
  217 | 
  218 |   page.on('pageerror', (error) => {
  219 |     diagnostics.pageErrors.push(error.message);
  220 |   });
  221 | 
  222 |   page.on('response', async (response) => {
  223 |     if (!response.url().includes('/api/') || response.ok()) {
  224 |       return;
  225 |     }
  226 | 
  227 |     let body = '';
  228 |     try {
  229 |       body = await response.text();
  230 |     } catch {
  231 |       body = '<unavailable>';
  232 |     }
  233 | 
  234 |     diagnostics.failedResponses.push(
  235 |       `${response
  236 |         .request()
  237 |         .method()} ${response.url()} -> ${response.status()} ${body}`
  238 |     );
  239 |   });
  240 | 
  241 |   page.on('requestfailed', (request) => {
  242 |     if (!request.url().includes('/api/')) {
  243 |       return;
  244 |     }
  245 | 
  246 |     if (request.failure()?.errorText === 'net::ERR_ABORTED') {
  247 |       return;
  248 |     }
  249 | 
  250 |     diagnostics.requestFailures.push(
  251 |       `${request.method()} ${request.url()} -> ${
  252 |         request.failure()?.errorText ?? 'unknown'
  253 |       }`
  254 |     );
  255 |   });
  256 | 
  257 |   return diagnostics;
  258 | }
  259 | 
  260 | function expectNoBrowserErrors(diagnostics: BrowserDiagnostics) {
  261 |   expect(
  262 |     diagnostics.failedResponses,
  263 |     `Failed responses:\n${diagnostics.failedResponses.join('\n')}`
  264 |   ).toEqual([]);
  265 |   expect(
  266 |     diagnostics.requestFailures,
  267 |     `Request failures:\n${diagnostics.requestFailures.join('\n')}`
  268 |   ).toEqual([]);
  269 |   expect(
  270 |     diagnostics.consoleErrors,
  271 |     `Console errors:\n${diagnostics.consoleErrors.join('\n')}`
> 272 |   ).toEqual([]);
      |     ^ Error: Console errors:
  273 |   expect(
  274 |     diagnostics.pageErrors,
  275 |     `Page errors:\n${diagnostics.pageErrors.join('\n')}`
  276 |   ).toEqual([]);
  277 | }
  278 | 
  279 | async function logRuntimeBundleContext(page: Page, diagnostics: BrowserDiagnostics) {
  280 |   if (!diagnostics.consoleErrors.some((entry) => entry.includes('ERROR rt'))) {
  281 |     return;
  282 |   }
  283 | 
  284 |   const debug = await page.evaluate(async () => {
  285 |     const chunkUrl = '/chunk-TBT5BTUI.js';
  286 |     const source = await fetch(chunkUrl).then((response) => response.text());
  287 |     const offset = 16318;
  288 |     const sourceMappingMatch = source.match(
  289 |       /\/\/# sourceMappingURL=(.+)$/m
  290 |     )?.[1];
  291 | 
  292 |     return {
  293 |       chunkUrl,
  294 |       sourceMappingMatch: sourceMappingMatch ?? null,
  295 |       slice: source.slice(Math.max(0, offset - 600), offset + 600),
  296 |       consoleErrors: (
  297 |         (window as Window & {
  298 |           __otConsoleErrors?: Array<{ args: unknown[]; stack?: string }>;
  299 |         }).__otConsoleErrors ?? []
  300 |       ).slice(-5),
  301 |       pageErrors: (
  302 |         (window as Window & {
  303 |           __otPageErrors?: Array<unknown>;
  304 |         }).__otPageErrors ?? []
  305 |       ).slice(-5),
  306 |       unhandledRejections: (
  307 |         (window as Window & {
  308 |           __otUnhandledRejections?: Array<unknown>;
  309 |         }).__otUnhandledRejections ?? []
  310 |       ).slice(-5),
  311 |     };
  312 |   });
  313 | 
  314 |   console.log(`BUNDLE_DEBUG ${JSON.stringify(debug)}`);
  315 | }
  316 | 
  317 | function logDiagnosticsCheckpoint(
  318 |   label: string,
  319 |   diagnostics: BrowserDiagnostics
  320 | ) {
  321 |   console.log(
  322 |     `DIAGNOSTICS ${label} ${JSON.stringify({
  323 |       consoleErrors: diagnostics.consoleErrors,
  324 |       pageErrors: diagnostics.pageErrors,
  325 |       failedResponses: diagnostics.failedResponses,
  326 |       requestFailures: diagnostics.requestFailures,
  327 |     })}`
  328 |   );
  329 | }
  330 | 
  331 | async function openMenu(page: Page) {
  332 |   await page.getByRole('button', { name: '☰' }).click();
  333 |   await page.waitForTimeout(200);
  334 | }
  335 | 
  336 | async function closeMenu(page: Page) {
  337 |   await page.keyboard.press('Escape');
  338 |   await page.waitForTimeout(100);
  339 | }
  340 | 
  341 | async function clickMenuItem(page: Page, label: string) {
  342 |   await openMenu(page);
  343 |   await page
  344 |     .locator('otui-modal button')
  345 |     .filter({ hasText: label })
  346 |     .first()
  347 |     .click();
  348 |   await page.waitForLoadState('networkidle');
  349 | }
  350 | 
  351 | async function currentPlanId(page: Page): Promise<string> {
  352 |   const match = page.url().match(/\/commander\/([^/]+)/);
  353 |   expect(match?.[1]).toBeTruthy();
  354 |   return match![1];
  355 | }
  356 | 
  357 | async function expectResponseOk(
  358 |   page: Page,
  359 |   matcher: Parameters<Page['waitForResponse']>[0],
  360 |   action: () => Promise<void>
  361 | ) {
  362 |   const responsePromise = page.waitForResponse(matcher, { timeout: 20000 });
  363 |   await action();
  364 |   const response = await responsePromise;
  365 |   expect(response.ok(), `${response.url()} -> ${response.status()}`).toBe(true);
  366 |   return response;
  367 | }
  368 | 
  369 | async function registerViaBrowser(
  370 |   page: Page,
  371 |   baseURL: string,
  372 |   user: BrowserUser
```