# AI Orchestrator

The AI orchestrator manages AI-oriented backend workflows for the platform. Its source lives under `apps/ai-orchestrator/src` and it coordinates model selection, tool-calling flows, and MCP-backed orchestration behavior.

## Local Development

Run it through the main repo stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/ai-orchestrator`

## Repo Role

- AI orchestration entrypoint for gateway-facing workflows
- central point for model selection, tool-calling, and MCP-assisted responses
- part of the canonical deployment inventory used by CI and k8s validation

## Nx Commands

```bash
pnpm exec nx build ai-orchestrator
pnpm exec nx test ai-orchestrator
```

## R3 downstream path audit (O25a)

Every downstream call on the gateway AI paths, classified. **Orchestrated**
flows must go through the ai-orchestrator; **direct** calls are data reads
or identity lookups that bypass it by design. Duplicate calls on
orchestrated flows are removed in O25b — this table is the checklist.

### `chat.gateway.ts` (websocket `chat` namespace)

| Handler                     | Downstream call                                      | Orchestrated / Direct | Notes                                   |
| --------------------------- | ---------------------------------------------------- | --------------------- | --------------------------------------- |
| `new_persona_chat`          | profile `Get`                                        | Direct                | identity lookup for the session profile |
| `new_persona_chat`          | telos `FIND_ONE`                                     | Direct                | persona lookup; read-only               |
| `new_persona_chat`          | ai-orchestrator `PROFILE_INITIALIZE`                 | **Orchestrated**      | kicks off the persona-chat flow         |
| `new_persona_chat`          | chat-collector `GET_CONVERSATIONS`                   | Direct                | refresh after init                      |
| `message`                   | telos `FIND`                                         | Direct                | recipient classification (AI vs human)  |
| `message`                   | chat-collector `POST_MESSAGE`                        | Direct                | persist first, always                   |
| `message` (AI branch)       | chat-collector `GET_CONVERSATION`                    | Direct                | assembles the AI payload                |
| `message` (AI branch)       | chat-collector `GET_CONVERSATIONS` ×2 (poll + final) | Direct                | live refresh while AI works             |
| `message` (AI branch)       | ai-orchestrator `CONVERSATION_UPDATE`                | **Orchestrated**      | the AI turn itself                      |
| `message` (tail fan-out)    | chat-collector `GET_CONVERSATIONS`                   | Direct                | per-recipient refresh                   |
| `get_conversations`         | chat-collector `GET_CONVERSATIONS`                   | Direct                | plain read                              |
| `get_or_create_direct_chat` | chat-collector `GET_OR_CREATE_DIRECT_CHAT`           | Direct                | plain provisioning                      |
| `get_messages`              | chat-collector `GET_MESSAGES`                        | Direct                | plain read (session-scoped)             |

### `profile.controller.ts` AI paths

| Handler            | Downstream call                      | Orchestrated / Direct | Notes                                      |
| ------------------ | ------------------------------------ | --------------------- | ------------------------------------------ |
| `createProfile`    | profile `Create`                     | Direct                | canonical write                            |
| `createProfile`    | ai-orchestrator `PROFILE_INITIALIZE` | **Orchestrated**      | per-profile AI setup (forgeofwill appId)   |
| `getProfileById`   | telos `FIND_ONE`                     | Direct                | back-fill when the profile row is missing  |
| `getProfilesByIds` | telos `FIND_ONE` (loop)              | Direct                | per-id back-fill; silently skipped on miss |

## Adding a downstream (O28)

Follow R1–R5 in order; each step names the file that owns it so the next
addition does not re-derive the pattern:

1. **Manifest (R1).** Add a block under `dependencies:` in
   `apps/ai-orchestrator/src/assets/config.yaml`. No new manifest file —
   the map is the single source of which downstreams exist.
2. **Composition (R1–R2).** Add the service id to `ORCHESTRATOR_SERVICE_IDS`
   and a `{ token, serviceId, required }` entry to
   `ORCHESTRATOR_DEPENDENCY_DEFS`, both in
   `apps/ai-orchestrator/src/app/app.module.ts`. Shared helpers
   (`normalizeGatewayComposition`, `loadGatewayCompositionFromFile`,
   `isServiceEnabled`, `DisabledClientProxy`) live in
   `libs/constants/src/lib/libs/service-composition.ts`. Mark optional
   downstreams `required: false` (today only `prompt-proxy`); the O27
   readiness gate fails closed on the required set.
3. **Single path (R2).** `createOrchestratorProviders(composition, map)`
   builds every provider from the registry — missing/disabled config
   yields a fail-fast `DisabledClientProxy`, never a boot throw. Unknown
   config keys log a warning naming the known keys.
4. **Contracts (R4).** Payloads come from the L-libs
   (`@optimistic-tanuki/profile-contracts` L8,
   `@optimistic-tanuki/chat-contracts` L4,
   `@optimistic-tanuki/telos-contracts`) — never `models`/`constants`
   shapes. Extend `orchestrator-contract-parity.spec.ts` with the new
   command + a valid/invalid DTO sample.
5. **Observability (R5).** The HealthCheck reply (`{ status, dependencies }`)
   picks the new service up automatically via
   `resolveOrchestratorDependencyStates`. Gateway ai-orchestration routes
   carry `AiOrchestrationReadinessInterceptor`
   (`apps/gateway/src/interceptors/`), which fails closed with 503;
   add it to any new route that _requires_ the orchestrator (not to
   fire-and-forget callers — see the R3 table above).
6. **Verify.** `nx run ai-orchestrator:test` (incl. `orchestrator-dependencies`,
   `orchestrator-health`, `orchestrator-contract-parity` specs) + lint,
   then the `ai-orchestration-readiness` gateway-e2e slice against the live
   stack.

## Model Configuration

The AI Orchestrator uses multiple specialized models for different tasks:

- **Workflow Control Model**: Quickly detects if a prompt requires tool calling
- **Tool Calling Model**: Optimized for executing actions through MCP tools
- **Conversational Model**: Generates natural language responses

For detailed information on model configuration, selection strategy, and best practices, see [MODEL_CONFIGURATION.md](./MODEL_CONFIGURATION.md).

## API Reference

The AI Orchestrator service exposes a RESTful API for interacting with its features. The API is documented using Swagger, and the documentation can be accessed at `http://localhost:3000/api/ai-orchestrator`.

## Features

- **Intelligent Workflow Detection**: Automatically routes prompts to appropriate models
- **Multi-Model Support**: Uses specialized models for different tasks
- **Thinking Token Filtering**: Automatically filters internal reasoning from responses
- **App-Aware Responses**: Contextual responses based on application configuration
- **Automatic Model Management**: Pulls and initializes models on startup
- **MCP Tool Integration**: Seamless integration with Model Context Protocol tools

## Related Docs

- [Model Configuration Guide](./MODEL_CONFIGURATION.md) - Comprehensive guide on model setup and configuration
- [LangChain Integration](./LANGCHAIN_INTEGRATION.md) - LangChain integration details
- [LangGraph Agent Integration](./LANGGRAPH_AGENT_INTEGRATION.md) - LangGraph agent documentation
- [MCP Integration](./APP_SERVICE_INTEGRATION.md) - MCP tool integration guide
