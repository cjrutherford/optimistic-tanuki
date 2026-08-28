#!/usr/bin/env node
/**
 * Model pilot for the project-planning AI features.
 *
 * Answers one question before anything is built on top: can any model on the
 * configured Ollama host hold a JSON schema and say something about a project
 * that a person could not read off the screen already.
 *
 * Scores four things per model, on both a summary and a change-proposal task:
 *
 *   parsed     the reply came back as JSON matching the schema
 *   grounded   it cited ids that really exist in the project, not invented ones
 *   noticed    it found the problems actually planted in the fixture
 *   latency    how long it took
 *
 * `grounded` is the one that matters. A model that writes a fluent paragraph
 * about a project it has cited nothing from is the failure mode this whole
 * exercise exists to catch, and it reads perfectly well.
 *
 * Usage:
 *   npx nx run ai-orchestrator:pilot
 *   OLLAMA_HOST=... OLLAMA_PORT=... npx nx run ai-orchestrator:pilot
 *   npx nx run ai-orchestrator:pilot --args="--models=qwen3:8b,llama3.2:3b"
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GROUNDING_SIGNALS,
  PROPOSAL_SCHEMA,
  SAMPLE_PROJECT,
  SUMMARY_SCHEMA,
  personaSystemPrompt,
  projectManagerPersona,
  proposalUserPrompt,
  summaryUserPrompt,
  validEvidenceIds,
} from './project-scenarios';

const HOST = process.env.OLLAMA_HOST || '100.89.87.124';
const PORT = Number(process.env.OLLAMA_PORT || 11434);
const BASE = `http://${HOST}:${PORT}`;
const WORKSPACE = process.env.NX_WORKSPACE_ROOT || process.cwd();
const TIMEOUT_MS = Number(process.env.PILOT_TIMEOUT_MS || 180_000);

interface TaskScore {
  task: 'summary' | 'proposal';
  parsed: boolean;
  grounded: number;
  groundedOf: number;
  invented: string[];
  noticed: string[];
  latencyMs: number;
  error?: string;
  sample?: string;
}

interface ModelScore {
  model: string;
  tasks: TaskScore[];
}

async function chat(
  model: string,
  system: string,
  user: string,
  schema: unknown
): Promise<{ content: string; ms: number }> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        // Same options the marking path settled on. temperature 0 alone made a
        // model loop inside one field until it ran out of room, so the repeat
        // penalty is load bearing rather than decorative.
        options: { temperature: 0, repeat_penalty: 1.1, num_predict: 1024 },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    const body = await response.json();
    return { content: body?.message?.content ?? '', ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

/** Ids the model cited, split into real and invented. */
function citations(parsed: unknown): { cited: string[]; invented: string[] } {
  const valid = validEvidenceIds();
  const cited: string[] = [];
  const invented: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(
        node as Record<string, unknown>
      )) {
        if (key === 'evidenceId' && typeof value === 'string') {
          (valid.has(value) ? cited : invented).push(value);
        } else {
          walk(value);
        }
      }
    }
  };
  walk(parsed);
  return { cited, invented };
}

/** Which planted problems the model actually found. */
function noticed(text: string): string[] {
  const haystack = text.toLowerCase();
  return GROUNDING_SIGNALS.filter((signal) =>
    signal.needles.some((needle) => haystack.includes(needle.toLowerCase()))
  ).map((signal) => signal.id);
}

async function scoreTask(
  model: string,
  task: 'summary' | 'proposal',
  system: string
): Promise<TaskScore> {
  const user = task === 'summary' ? summaryUserPrompt() : proposalUserPrompt();
  const schema = task === 'summary' ? SUMMARY_SCHEMA : PROPOSAL_SCHEMA;
  try {
    const { content, ms } = await chat(model, system, user, schema);
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(content);
    } catch {
      return {
        task,
        parsed: false,
        grounded: 0,
        groundedOf: 0,
        invented: [],
        noticed: [],
        latencyMs: ms,
        error: 'unparseable',
        sample: content.slice(0, 160),
      };
    }
    const { cited, invented } = citations(parsedBody);
    return {
      task,
      parsed: true,
      grounded: new Set(cited).size,
      groundedOf: new Set([...cited, ...invented]).size,
      invented: [...new Set(invented)],
      noticed: noticed(content),
      latencyMs: ms,
      sample: JSON.stringify(parsedBody).slice(0, 160),
    };
  } catch (error) {
    return {
      task,
      parsed: false,
      grounded: 0,
      groundedOf: 0,
      invented: [],
      noticed: [],
      latencyMs: TIMEOUT_MS,
      error: (error as Error).name === 'AbortError' ? 'timeout' : String(error),
    };
  }
}

async function availableModels(): Promise<string[]> {
  const response = await fetch(`${BASE}/api/tags`);
  const body = await response.json();
  return (body.models ?? []).map((m: { name: string }) => m.name);
}

async function main(): Promise<void> {
  const requested = process.argv
    .find((arg) => arg.startsWith('--models='))
    ?.split('=')[1]
    ?.split(',')
    .filter(Boolean);
  const models = requested?.length ? requested : await availableModels();
  const persona = projectManagerPersona(WORKSPACE);
  const system = personaSystemPrompt(persona);

  console.log(`Ollama:  ${BASE}`);
  console.log(`Persona: ${persona.name} (from the seeded personas.json)`);
  console.log(
    `Project: ${SAMPLE_PROJECT.name}, ${SAMPLE_PROJECT.tasks.length} tasks, ${SAMPLE_PROJECT.risks.length} risks`
  );
  console.log(`Models:  ${models.length}\n`);

  const scores: ModelScore[] = [];
  for (const model of models) {
    const tasks: TaskScore[] = [];
    for (const task of ['summary', 'proposal'] as const) {
      const score = await scoreTask(model, task, system);
      tasks.push(score);
      const flag = score.parsed ? 'ok  ' : 'FAIL';
      console.log(
        `${flag} ${model.padEnd(58)} ${task.padEnd(9)} ` +
          `cited ${score.grounded}/${score.groundedOf} ` +
          `noticed ${score.noticed.length}/${GROUNDING_SIGNALS.length} ` +
          `${(score.latencyMs / 1000).toFixed(0)}s` +
          (score.error ? `  ${score.error}` : '') +
          (score.invented.length
            ? `  invented:${score.invented.join(',')}`
            : '')
      );
    }
    scores.push({ model, tasks });
  }

  const out = join(WORKSPACE, 'project-pilot-results.json');
  writeFileSync(
    out,
    JSON.stringify({ host: BASE, persona: persona.name, scores }, null, 2)
  );
  console.log(`\nWrote ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
