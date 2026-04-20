# AI Orchestrator E2E

This project contains end-to-end tests for the AI orchestrator service and its gateway-facing behavior.

## Local Run

The tests expect the required services to be available locally.

Recommended flow:

```bash
# From repo root
./scripts/start-e2e-deps.sh

# Then run the suite
pnpm exec nx e2e ai-orchestrator-e2e --skip-nx-cache --testTimeout=30000
```

## Expected Local Dependencies

The current test assumptions are:

- gateway on `http://localhost:3000`
- profile on `http://localhost:3002`
- ai-orchestrator on `http://localhost:3010`

If your local stack uses different endpoints, update the helper script or run the required services manually.

## Notes

- The e2e project does not auto-start the ai-orchestrator service.
- The helper script uses Docker Compose to bring up supporting services and waits for the required host ports.
- If the helper script does not match your local environment, prefer documenting and using the exact manual stack you need rather than relying on implicit auto-start behavior.
