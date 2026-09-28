# Vault Copilot: MCP tools and the air gap

The Practice Vault copilot answers questions about confidential client documents.
Those documents are tax schedules, deposition transcripts, and escrow material,
so two things have to be true at once: the answer has to come from a document the
caller actually owns, and nothing about the document may leave the premises.

Both used to be claims. The copilot opened its own socket to Ollama from the AI
service, sent a prompt containing the caller's question and a list of document
ids, and returned `airGapped: true` because it had dialled an address someone had
put in a config file. No document text was ever retrieved, so there was nothing
in the prompt to leak and nothing in the answer to ground it in.

This is how it works now.

## The path a question takes

```
client
  → POST /api/vault/copilot/query        gateway   AuthGuard + PermissionsGuard(VAULT_STAFF_PERMISSION)
                                             VaultTenantResolver → tenantId
                                             forwards { query, documentIds, tenantId, accessToken }
  → COPILOT_QUERY_DOCUMENTS              ai-orchestrator  VaultCopilotService
                                             opens ToolsService.session(accessToken)
  → MCP /api/mcp (Bearer <accessToken>)  gateway   McpAuthGuard attaches request.user
                                             VaultMcpService re-derives the tenant from the session
  → vault_search_documents               → compliance-audit   tenant-scoped, RLS-bound
  → vault_parse_transcript               → compliance-audit   deterministic parse
  → vault_parse_tax_schedule             → compliance-audit   deterministic parse
  → vault_generate                       → local Ollama only
```

The model is reached through `vault_generate`, an MCP tool, not through a
connection the copilot opens itself. That is what makes the air gap a control:
the copilot has no code path to a model that does not go through the check
described below.

## Tenant binding

Three independent things have to agree, and none of them is client-supplied:

1. The gateway resolves the tenant with `VaultTenantResolver`, which asks the
   finance service which tenant this principal belongs to. A principal finance
   does not recognise is refused before anything is dispatched.
2. `accessToken` is the caller's own bearer token, read from the `Authorization`
   header and written into the dispatch payload _after_ the request body is
   spread, so a client that puts a credential in the body has it replaced.
3. Every vault MCP tool derives its tenant from the session `McpAuthGuard`
   authenticated, resolved through `VaultTenantResolver` again. No vault tool
   accepts a `tenantId` argument at all — see
   `apps/gateway/src/app/mcp/vault-mcp.service.spec.ts`, which calls the search
   tool with `tenantId: 'northgate-law'` in its arguments and asserts the
   compliance-audit call still carries the session's own tenant.

A document id is checked against that tenant inside the query, and again by
PostgreSQL row level security on `vault_documents`. The RLS policy is the same
one `compliance_audit_logs` uses, and it is `FORCE`d, so a query that forgot the
tenant predicate reads no rows rather than another tenant's documents.

A document that does not exist and a document that belongs to somebody else come
back identically: same empty excerpt list, same entry in
`unavailableDocumentIds`. Distinguishing them would turn the tool into a probe for
what other tenants hold. Verified against a live Postgres in the slice
implementation:

```
no binding                     -> rows visible: 0
bound to 'wirepro-cpa'         -> rows visible: 1   (content: wirepro secret)
```

## The air gap

`apps/gateway/src/app/mcp/air-gap/local-endpoint.guard.ts`. Two rules, both
applied on **every** request rather than once at boot, so a deployment re-pointed
at a public host starts failing instead of quietly leaking:

1. The endpoint has to be a syntactically valid `http(s)` URL with no credentials
   in it. Anything else — `file://`, `gopher://`, a URL with `user:pass@` — is
   refused by name.
2. Every address the host resolves to must be a loopback, private, link-local, or
   carrier-grade-NAT address. Loopback and `::1`; RFC 1918 `10/8`, `172.16/12`,
   `192.168/16`; link-local `169.254/16`; CGNAT `100.64/10`; IPv6 unique-local
   `fc00::/7` and link-local `fe80::/10`; and IPv4-mapped forms of all of those.
   A name that resolves to a public address is refused, and so is one that
   resolves to a mix — that is what a DNS rebind looks like.

`100.64.0.0/10` is in the allowed set because this deployment reaches its model
over a tailnet address rather than loopback. Treating that range as public would
have been a way of saying the air gap holds while forbidding the one
configuration actually in use.

Three further properties:

- **Redirects are refused.** The request is sent with `redirect: 'error'`, so a
  `302` from the model host cannot replay the confidential prompt to another
  origin on the way out.
- **The check is not done once at boot.** `VaultModelService.generate` resolves
  and re-validates the endpoint on every call. A test asserts that mutating the
  configured endpoint after a successful call makes the next call fail.
- **Unset means refuse.** There is no default host. `vault.ollama.baseUrl` is
  empty in source; with no `VAULT_OLLAMA_BASE_URL` the request fails with
  `VaultAirGapError` and the copilot reports that the model was unreachable.

The residual, stated plainly: DNS is resolved once by the check and once again by
the socket. A host that returns a local address to the check and a public one to
the connect would pass. Closing that needs a pinned socket or a network
namespace, neither of which is available to a plain `fetch`, so the check runs
immediately before every request and the endpoint is expected to be an address
rather than a name.

## What the copilot does when something is wrong

There is no fallback text, because a fallback is a fabricated answer wearing an
error's clothes. Every one of these returns
`{ answer: <what went wrong>, model: 'none', sources: [], airGapped: false }`:

| Condition                                       | Behaviour                                                |
| ----------------------------------------------- | -------------------------------------------------------- |
| No tenant on the call                           | `UnauthorizedException`, nothing is dispatched           |
| No caller credential                            | `UnauthorizedException`, nothing is dispatched           |
| No document ids named                           | explicit failure; the vault is never searched unprompted |
| Document not in the tenant, or no readable text | explicit failure; **the model is never called**          |
| Model unreachable, non-2xx, or empty completion | explicit failure, no sources                             |
| Endpoint not on this network                    | explicit failure naming the air gap refusal              |
| Model reply is not `{answer, citations[]}`      | explicit failure, no sources                             |
| Model cites no passage it was given             | explicit failure, no sources                             |

`sources` is only ever the retrieved passages a grounded answer actually cited.
Passages that were retrieved are not evidence for an answer that was not
produced, so a failure carries none. A citation naming a label the model was not
given is dropped rather than resolved to a plausible-looking document.

## Deterministic parsing

`vault_parse_transcript` and `vault_parse_tax_schedule` do not use a model. A
transcript is already structured, and the two things a reviewer needs from a parse
— who said what, and on which page — are recoverable exactly, so a language model
would only add a way to be wrong about the page number.

- **Transcript** (`apps/compliance-audit/src/app/vault-parsers/transcript.parser.ts`):
  page markers (`--- 12 ---`, `Page 12`, a bare number), speaker headings,
  reporter line-number gutters, `Q.`/`A.` turns attributed to whoever is
  speaking, unwrapped continuation lines folded into the turn they belong to,
  exhibit markers collected separately, and the appearances block read into
  party/counsel pairs. Header fields that are not on the page are `null`.
- **Tax schedule** (`tax-schedule.parser.ts`): numbered line items with part
  headings, amounts in every form a printed schedule uses (`$1,234.56`,
  `(1,234.56)`, `1,234.56-`, `-$1,234.56`), Form 1040 suffixed line refs
  (`1a`, `1b`) preserved exactly, and a pipe-delimited extraction shape as well as
  a tabular one.

The schedule parser reports the totals the schedule **printed** and separately
states whether those printed figures are consistent with each other. It does not
sum an excerpt: a Schedule C has expense lines a page may never have shown, so a
sum would be an authoritative-looking number that is wrong. A numbered line with
no amount goes to `unparsedLines`, not to zero — a line that was not read is a gap
in the evidence, and zero is a claim.

## Environment variables

| Variable                                  | Purpose                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `VAULT_OLLAMA_BASE_URL`                   | The on-premises Ollama endpoint. **Required** for the vault path; unset means the copilot refuses to run. |
| `VAULT_OLLAMA_MODEL`                      | Overrides `vault.model.name`. Default `qwen2.5-coder:14b`.                                                |
| `VAULT_OLLAMA_NUM_CTX`                    | Overrides `vault.model.numCtx`. Default `32768`.                                                          |
| `VAULT_OLLAMA_TEMPERATURE`                | Overrides `vault.model.temperature`. Default `0.1`.                                                       |
| `VAULT_OLLAMA_TIMEOUT_MS`                 | Overrides `vault.model.timeoutMs`. Default `60000`.                                                       |
| `SERVICE_COMPLIANCE_AUDIT_HOST` / `_PORT` | Where the vault document store lives. Default `localhost:3025`.                                           |

The non-vault model configuration in `apps/ai-orchestrator` is unchanged. Its
`ollama.host` is now empty in source rather than a hardcoded tailnet address, and
`OLLAMA_HOST` names it; with no host configured the existing
`http://prompt-proxy:11434` fallback in `ModelManager` still applies, so the
other features are unaffected either way.
