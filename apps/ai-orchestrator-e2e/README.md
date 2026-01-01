# AI Orchestrator E2E

This folder contains end-to-end tests that exercise the AI orchestration microservice.

## How to run the e2e tests locally

1. Start the required services (recommended):

```bash
# From repository root - starts the dev docker-compose stack and waits for ports
./scripts/start-e2e-deps.sh
```

2. Run the e2e tests (assumes services are running locally on the ports used by the repo):

```bash
npx nx e2e ai-orchestrator-e2e --skip-nx-cache --testTimeout=30000
```

## Notes

- The e2e runner currently assumes the `gateway` (port 3000), `profile` (port 3002), and `ai-orchestrator` (port 3010) services are available locally. Adjust `scripts/start-e2e-deps.sh` if your environment uses different ports or service names.
- The test project is configured to NOT auto-start the `ai-orchestrator` service; this avoids EADDRINUSE issues if a service is already running. Use the start script to bring up services or run them manually.
