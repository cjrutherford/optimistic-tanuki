/**
 * Project-planning scenarios for the model pilot.
 *
 * These exist to answer one question before any AI project feature is built:
 * can anything on the Ollama host hold a JSON schema and say something about a
 * project that a person could not already read off the screen.
 *
 * Two decisions worth knowing about.
 *
 * The personas come from the same `personas.json` the telos service seeds,
 * read at runtime rather than copied. A pilot run against invented personas
 * tells you about the invented personas. Patricia P. Project is the one that
 * matters here, and her real definition includes a limitation saying her
 * advice is general rather than project specific, which is exactly the kind of
 * thing a copy would have quietly dropped.
 *
 * The calls go straight to Ollama with `format` carrying a JSON schema, not
 * through LangChain and not through prompt-proxy. That is what a real
 * implementation would have to do: prompt-proxy types its `format` field as
 * the string 'json' and cannot carry a schema, which the learning service hit
 * and worked around the same way. Piloting through a different mechanism than
 * the one we would ship would measure the wrong thing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SeedPersona {
  name: string;
  description: string;
  coreObjective: string;
  promptTemplate: string;
  goals: string[];
  skills: string[];
  strengths: string[];
  limitations: string[];
}

/** The personas the platform actually seeds, not a copy of them. */
export function loadSeedPersonas(workspaceRoot: string): SeedPersona[] {
  const path = join(
    workspaceRoot,
    'apps',
    'telos-docs-service',
    'src',
    'assets',
    'personas.json'
  );
  return JSON.parse(readFileSync(path, 'utf8')) as SeedPersona[];
}

export function projectManagerPersona(workspaceRoot: string): SeedPersona {
  const personas = loadSeedPersonas(workspaceRoot);
  const patricia = personas.find((persona) =>
    persona.name.toLowerCase().includes('patricia')
  );
  if (!patricia) {
    throw new Error(
      'Patricia P. Project is missing from personas.json. The pilot is meant ' +
        'to run against the seeded personas, so this is a real failure rather ' +
        'than something to substitute around.'
    );
  }
  return patricia;
}

/**
 * A project with things genuinely wrong with it.
 *
 * Deliberately not a tidy fixture. Two tasks are overdue, one has nobody on
 * it, a high impact risk has no mitigation, and one task has been in progress
 * far longer than the others. A model that says something useful will name at
 * least one of those. A model that says "the project has 6 tasks and is
 * progressing well" has told the reader nothing they could not count.
 */
export const SAMPLE_PROJECT = {
  id: 'proj-forge-1',
  name: 'Kiln rebuild',
  description: 'Replace the failing kiln liner and recommission before winter.',
  tasks: [
    {
      id: 't1',
      title: 'Order replacement liner segments',
      status: 'DONE',
      priority: 'HIGH',
      assignee: 'sam',
      dueDate: '2026-07-30',
    },
    {
      id: 't2',
      title: 'Strip the old liner',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      assignee: 'sam',
      dueDate: '2026-08-04',
    },
    {
      id: 't3',
      title: 'Book the crane for lift-in',
      status: 'TODO',
      priority: 'MEDIUM_HIGH',
      assignee: null,
      dueDate: '2026-08-10',
    },
    {
      id: 't4',
      title: 'Recommissioning burn test',
      status: 'TODO',
      priority: 'HIGH',
      assignee: 'dana',
      dueDate: '2026-09-15',
    },
    {
      id: 't5',
      title: 'Update the maintenance log template',
      status: 'TODO',
      priority: 'LOW',
      assignee: 'dana',
      dueDate: null,
    },
    {
      id: 't6',
      title: 'Insurance re-inspection paperwork',
      status: 'TODO',
      priority: 'MEDIUM',
      assignee: null,
      dueDate: '2026-08-01',
    },
  ],
  risks: [
    {
      id: 'r1',
      title: 'Crane availability in August is unconfirmed',
      impact: 'HIGH',
      status: 'OPEN',
      mitigation: null,
    },
    {
      id: 'r2',
      title: 'Liner segments may arrive warped',
      impact: 'MEDIUM',
      status: 'MITIGATED',
      mitigation: 'Inspect on delivery, supplier replaces within 5 days',
    },
  ],
  today: '2026-08-27',
};

/**
 * What a grounded answer has to touch.
 *
 * Scoring against these rather than against fluency, because a well written
 * paragraph restating the task count is the easy failure here and reads fine.
 */
export const GROUNDING_SIGNALS: {
  id: string;
  label: string;
  needles: string[];
}[] = [
  {
    id: 'overdue',
    label: 'Notices something is overdue',
    needles: [
      'overdue',
      'past due',
      'late',
      'behind',
      'strip the old liner',
      'insurance re-inspection',
    ],
  },
  {
    id: 'unassigned',
    label: 'Notices work with nobody on it',
    needles: [
      'unassigned',
      'no assignee',
      'nobody',
      'not assigned',
      'book the crane',
      'insurance re-inspection',
    ],
  },
  {
    id: 'risk',
    label: 'Notices the unmitigated high risk',
    needles: ['crane', 'unmitigated', 'no mitigation', 'availability'],
  },
];

export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    concerns: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          about: { type: 'string' },
          why: { type: 'string' },
          evidenceId: { type: 'string' },
        },
        required: ['about', 'why', 'evidenceId'],
      },
    },
  },
  required: ['headline', 'concerns'],
};

export const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['create_task', 'update_task', 'assign_task'],
          },
          reason: { type: 'string' },
          evidenceId: { type: 'string' },
          payload: {
            type: 'object',
            properties: {
              taskId: { type: 'string' },
              title: { type: 'string' },
              assignee: { type: 'string' },
              dueDate: { type: 'string' },
            },
          },
        },
        required: ['operation', 'reason', 'evidenceId', 'payload'],
      },
    },
  },
  required: ['proposals'],
};

/** Every id a model may legitimately cite as evidence. */
export function validEvidenceIds(): Set<string> {
  return new Set([
    ...SAMPLE_PROJECT.tasks.map((task) => task.id),
    ...SAMPLE_PROJECT.risks.map((risk) => risk.id),
    SAMPLE_PROJECT.id,
  ]);
}

export function personaSystemPrompt(persona: SeedPersona): string {
  return [
    persona.promptTemplate,
    '',
    `You are ${persona.name}. ${persona.description}`,
    `Your core objective: ${persona.coreObjective}`,
    `Your goals: ${persona.goals.join('; ')}`,
    `Your skills: ${persona.skills.join('; ')}`,
    '',
    // Patricia's seeded limitations include "advice is general, not
    // project-specific". The project is supplied here, so that limitation is
    // addressed rather than ignored. If it were left in place unqualified the
    // model would be right to refuse, and the pilot would be measuring the
    // persona rather than the model.
    'The project below is supplied to you in full, so you can and should be',
    'specific about it. Refer to tasks and risks by their id.',
    '',
    'Say only what the data supports. Every concern or proposal must cite the',
    'id of the task or risk it comes from. Do not invent tasks, people or',
    'dates that are not in the project.',
  ].join('\n');
}

export function summaryUserPrompt(): string {
  return [
    `Today is ${SAMPLE_PROJECT.today}.`,
    '',
    'PROJECT',
    JSON.stringify(SAMPLE_PROJECT, null, 2),
    '',
    'Write a short headline about where this project stands, then list the',
    'concerns that a project manager should raise. Cite the id of the task or',
    'risk each concern comes from.',
  ].join('\n');
}

export function proposalUserPrompt(): string {
  return [
    `Today is ${SAMPLE_PROJECT.today}.`,
    '',
    'PROJECT',
    JSON.stringify(SAMPLE_PROJECT, null, 2),
    '',
    'Propose changes that would move this project forward. Each proposal names',
    'one operation, the id of the task or risk that prompted it, and the fields',
    'to change. Propose nothing you cannot tie to something in the project.',
  ].join('\n');
}
