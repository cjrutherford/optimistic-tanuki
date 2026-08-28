#!/usr/bin/env node
/**
 * Model pilot for the project-planning AI features.
 *
 * Answers one question before anything is built on top: can any model on the
 * configured Ollama host hold a schema and say something about a project that
 * a person could not read off the screen already.
 *
 * Runs through LangChain, because that is what this platform standardises on
 * for model work. `withStructuredOutput` for the two shaped tasks and
 * `bindTools` for the tool-calling one, so the pilot measures the same path a
 * real implementation here would take rather than a mechanism we would not
 * ship.
 *
 * Three tasks per model:
 *
 *   summary    structured output, a headline and grounded concerns
 *   proposal   structured output, changes each tied to a task or risk
 *   tools      bindTools, which is what LangGraph's react agent needs to work
 *
 * Scored on:
 *
 *   parsed     came back in the requested shape at all
 *   cited      ids that really exist in the project, against ids invented
 *   noticed    which of the problems planted in the fixture it found
 *   latency
 *
 * `cited` and `noticed` are the ones that matter. A model that writes a fluent
 * paragraph about a project it has cited nothing from is the failure this
 * exercise exists to catch, and it reads perfectly well.
 *
 * Usage:
 *   npx nx run ai-orchestrator:pilot
 *   npx nx run ai-orchestrator:pilot --args="--models=qwen3:8b,llama3.2:3b"
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  GROUNDING_SIGNALS,
  ProposalSchema,
  ProposeChangeTool,
  SAMPLE_PROJECT,
  SummarySchema,
  personaSystemPrompt,
  projectManagerPersona,
  proposalUserPrompt,
  summaryUserPrompt,
  toolUserPrompt,
  validEvidenceIds,
} from './project-scenarios';

const HOST = process.env.OLLAMA_HOST || '100.89.87.124';
const PORT = Number(process.env.OLLAMA_PORT || 11434);
const BASE = `http://${HOST}:${PORT}`;
const WORKSPACE = process.env.NX_WORKSPACE_ROOT || process.cwd();
const TIMEOUT_MS = Number(process.env.PILOT_TIMEOUT_MS || 180_000);

type TaskName = 'summary' | 'proposal' | 'tools';

interface TaskScore {
  task: TaskName;
  parsed: boolean;
  cited: number;
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

function model(name: string): ChatOllama {
  return new ChatOllama({
    model: name,
    baseUrl: BASE,
    // temperature 0 alone made a model loop inside one field until it ran out
    // of room when the marking path was tuned, so the repeat penalty is load
    // bearing rather than decorative.
    temperature: 0,
    repeatPenalty: 1.1,
  });
}

function withDeadline<T>(work: Promise<T>): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
    ),
  ]);
}

/** Ids the model cited, split into real and invented. */
function citations(value: unknown): { cited: string[]; invented: string[] } {
  const valid = validEvidenceIds();
  const cited: string[] = [];
  const invented: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') {
      for (const [key, item] of Object.entries(
        node as Record<string, unknown>
      )) {
        if (key === 'evidenceId' && typeof item === 'string') {
          (valid.has(item) ? cited : invented).push(item);
        } else {
          walk(item);
        }
      }
    }
  };
  walk(value);
  return { cited, invented };
}

/** Which planted problems the model actually found. */
function noticed(text: string): string[] {
  const haystack = text.toLowerCase();
  return GROUNDING_SIGNALS.filter((signal) =>
    signal.needles.some((needle) => haystack.includes(needle.toLowerCase()))
  ).map((signal) => signal.id);
}

function scoreFrom(
  task: TaskName,
  value: unknown,
  latencyMs: number
): TaskScore {
  const { cited, invented } = citations(value);
  const text = JSON.stringify(value);
  return {
    task,
    parsed: true,
    cited: new Set(cited).size,
    invented: [...new Set(invented)],
    noticed: noticed(text),
    latencyMs,
    sample: text.slice(0, 160),
  };
}

function failure(task: TaskName, error: unknown, latencyMs: number): TaskScore {
  const message = error instanceof Error ? error.message : String(error);
  return {
    task,
    parsed: false,
    cited: 0,
    invented: [],
    noticed: [],
    latencyMs,
    error: message.slice(0, 120),
  };
}

async function runStructured(
  name: string,
  task: 'summary' | 'proposal',
  system: string
): Promise<TaskScore> {
  const started = Date.now();
  try {
    const schema = task === 'summary' ? SummarySchema : ProposalSchema;
    const user =
      task === 'summary' ? summaryUserPrompt() : proposalUserPrompt();
    const structured = model(name).withStructuredOutput(schema, {
      name: task,
    });
    const result = await withDeadline(
      structured.invoke([new SystemMessage(system), new HumanMessage(user)])
    );
    return scoreFrom(task, result, Date.now() - started);
  } catch (error) {
    return failure(task, error, Date.now() - started);
  }
}

async function runTools(name: string, system: string): Promise<TaskScore> {
  const started = Date.now();
  try {
    const bound = model(name).bindTools([ProposeChangeTool]);
    const reply = await withDeadline(
      bound.invoke([
        new SystemMessage(system),
        new HumanMessage(toolUserPrompt()),
      ])
    );
    const calls = reply.tool_calls ?? [];
    if (calls.length === 0) {
      return {
        ...failure(
          'tools',
          new Error('answered in prose, no tool call'),
          Date.now() - started
        ),
        sample: String(reply.content).slice(0, 160),
      };
    }
    return scoreFrom(
      'tools',
      calls.map((call) => call.args),
      Date.now() - started
    );
  } catch (error) {
    return failure('tools', error, Date.now() - started);
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

  console.log(`Ollama:  ${BASE} (via LangChain ChatOllama)`);
  console.log(`Persona: ${persona.name} (from the seeded personas.json)`);
  console.log(
    `Project: ${SAMPLE_PROJECT.name}, ${SAMPLE_PROJECT.tasks.length} tasks, ${SAMPLE_PROJECT.risks.length} risks`
  );
  console.log(`Models:  ${models.length}\n`);

  const scores: ModelScore[] = [];
  for (const name of models) {
    const tasks: TaskScore[] = [
      await runStructured(name, 'summary', system),
      await runStructured(name, 'proposal', system),
      await runTools(name, system),
    ];
    for (const score of tasks) {
      console.log(
        `${score.parsed ? 'ok  ' : 'FAIL'} ${name.padEnd(58)} ` +
          `${score.task.padEnd(9)} cited ${score.cited} ` +
          `noticed ${score.noticed.length}/${GROUNDING_SIGNALS.length} ` +
          `${(score.latencyMs / 1000).toFixed(0)}s` +
          (score.error ? `  ${score.error}` : '') +
          (score.invented.length
            ? `  invented:${score.invented.join(',')}`
            : '')
      );
    }
    scores.push({ model: name, tasks });
  }

  const out = join(WORKSPACE, 'project-pilot-results.json');
  writeFileSync(
    out,
    JSON.stringify(
      { host: BASE, via: 'langchain', persona: persona.name, scores },
      null,
      2
    )
  );
  console.log(`\nWrote ${out}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
