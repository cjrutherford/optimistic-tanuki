import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import axios, { AxiosInstance } from 'axios';

/**
 * AI-orchestration readiness gate (O27b).
 *
 * Live-stack scope: proves an ai-orchestration route fails closed with a
 * clean 503 (not a hang) when a REQUIRED downstream reports disabled, and
 * passes through when healthy. The disabled state is produced by restarting
 * ot_ai_orchestration with a temporary composition file that omits
 * telos-docs-service, then restoring it — the stack is left exactly as
 * found.
 *
 * Requires the live stack (`BASE_URL`, default http://localhost:3000) plus
 * local docker access. Not runnable without them.
 */
describe('AI orchestration readiness gate (O27b)', () => {
  jest.setTimeout(240000);
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  const api: AxiosInstance = axios.create({
    baseURL: `${baseURL}/api`,
    validateStatus: () => true,
  });

  const COMPOSE_PROJECT = 't3code-baf8592e';
  const COMPOSE_FILES = ['docker-compose.yaml', 'docker-compose.dev.yaml'];
  const COMPOSITION_PATH = '/tmp/e2e-ai-composition.yaml';
  const OVERRIDE_PATH = '/tmp/e2e-ai-override.yaml';

  function compose(args: string): string {
    const files = COMPOSE_FILES.map((f) => `-f ${f}`).join(' ');
    return execSync(`docker compose -p ${COMPOSE_PROJECT} ${files} ${args}`, {
      cwd: '/home/cjrutherford/workspace/optimistic-tanuki',
      encoding: 'utf8',
      timeout: 180000,
    });
  }

  function restartOrchestrator(compositionServices: string[] | null) {
    if (compositionServices === null) {
      try {
        unlinkSync(OVERRIDE_PATH);
      } catch {
        // Already restored.
      }
      try {
        unlinkSync(COMPOSITION_PATH);
      } catch {
        // Already restored.
      }
      compose('up -d ai-orchestration');
    } else {
      writeFileSync(
        COMPOSITION_PATH,
        `enabledServices:\n${compositionServices
          .map((s) => `  - ${s}`)
          .join('\n')}\n`
      );
      writeFileSync(
        OVERRIDE_PATH,
        `services:\n  ai-orchestration:\n    environment:\n      GATEWAY_COMPOSITION_PATH: ${COMPOSITION_PATH}\n    volumes:\n      - ${COMPOSITION_PATH}:${COMPOSITION_PATH}:ro\n`
      );
      compose(`-f ${OVERRIDE_PATH} up -d ai-orchestration`);
    }
  }

  async function restartOrchestratorAndSettle(
    compositionServices: string[] | null
  ): Promise<void> {
    restartOrchestrator(compositionServices);
    // The gateway itself never restarts; only the orchestrator needs boot time.
    await new Promise((resolve) => setTimeout(resolve, 25000));
  }

  it('passes AI calls through when every downstream is enabled', async () => {
    const res = await api.post('/wellness/ai/context', {
      contextType: 'general',
    });

    // Whatever the model does, the readiness gate itself must not refuse.
    expect(res.status).not.toBe(503);
  });

  it('fails closed with 503 when a required downstream is disabled', async () => {
    await restartOrchestratorAndSettle([
      'profile',
      'chat-collector',
      'prompt-proxy',
    ]);
    try {
      const res = await api.post('/wellness/ai/context', {
        contextType: 'general',
      });

      expect(res.status).toBe(503);
      expect(JSON.stringify(res.data)).toMatch(/unavailable/i);
    } finally {
      await restartOrchestratorAndSettle(null);
    }
  }, 240000);
});
