import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  PersonaTelosCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';

/**
 * Who the assistant is, drawn from the persona teloses that already exist.
 *
 * Eleven of them are seeded and the agent has never asked for one. It built a
 * prompt string of its own and answered as nobody, while a whole persona layer
 * sat unused beside it.
 *
 * The important rule is in `identityLines`: a persona supplies identity and
 * voice and never behaviour. That is not tidiness, it is the outcome of three
 * failed attempts to prompt a small model out of describing its tool output
 * instead of answering. The seeded records are written for an advice chatbot
 * and would push it straight back there.
 */

/** A persona telos, as much of one as this service reads. */
export interface PersonaTelos {
  id: string;
  name: string;
  description?: string;
  strengths?: string[];
  interests?: string[];
  coreObjective?: string;
  /** What this persona may do. Null means no scope was ever decided. */
  capabilities?: string[] | null;
}

/** Who is speaking, ready to be put in a prompt and shown to a reader. */
export interface Voice {
  id: string;
  name: string;
  /** One line about them, for the panel to show beside their name. */
  blurb: string;
  /** Identity lines for a prompt. Never instructions. */
  identityLines: string[];
  /**
   * What this persona can and cannot do, said plainly, or null when no scope
   * was ever decided. Derived from the scope rather than from the telos text,
   * which is why it may be behaviour where the identity lines may not.
   */
  limits: string | null;
  /**
   * The tools this persona may reach, or null for all of them.
   *
   * Worked out from the capabilities on their record. Null is not "unset" by
   * accident: it is what a persona with no capabilities decided has always
   * had, and keeping it distinct from an empty list is what lets a persona be
   * given read access and nothing else.
   */
  tools: string[] | null;
}

/**
 * What each capability lets a persona actually reach.
 *
 * The persona record names capabilities rather than tools, so that a record
 * stays readable, survives a tool being renamed, and does not leave a newly
 * added tool belonging to nobody. Adding a tool here is the one place that has
 * to change.
 *
 * `read` is deliberately generous. Looking at a project is not what the
 * approval gate exists to control, and a persona that cannot read anything
 * cannot answer a question either, which makes choosing them pointless rather
 * than safe.
 */
export const TOOLS_BY_CAPABILITY: Record<string, string[]> = {
  read: [
    'list_projects',
    'get_project',
    'query_projects',
    'list_tasks',
    'get_task',
    'query_tasks',
    'count_tasks',
    'list_risks',
    'query_risks',
    'list_changes',
    'query_changes',
    'list_journal_entries',
    'query_journal_entries',
  ],
  tasks: ['create_task', 'update_task', 'delete_task'],
  risks: ['create_risk', 'update_risk', 'delete_risk'],
  changes: ['create_change', 'update_change', 'delete_change'],
  journal: ['create_journal_entry', 'update_journal_entry'],
  projects: ['create_project', 'update_project', 'delete_project'],
};

/**
 * The tools a set of capabilities adds up to.
 *
 * Null in, null out: a persona with no capabilities decided has never had a
 * scope and keeps every tool, which is what every record did before the column
 * existed. An empty list is a decision, and means look but do not act.
 */
export function toolsFor(
  capabilities: string[] | null | undefined
): string[] | null {
  if (capabilities == null) return null;

  const named = new Set<string>();
  for (const capability of capabilities) {
    for (const tool of TOOLS_BY_CAPABILITY[capability] ?? []) {
      named.add(tool);
    }
  }
  return [...named];
}

/** What each capability lets a persona change, said in words. */
const CHANGES_BY_CAPABILITY: Record<string, string> = {
  tasks: 'tasks',
  risks: 'risks',
  changes: 'change records',
  journal: 'journal entries',
  projects: 'projects',
};

/**
 * What a persona can and cannot do, for the prompt.
 *
 * Without this a persona simply does not see the tools it lacks, and a model
 * that cannot find a way to do what was asked tends to invent one or to claim
 * it did it. Saying so plainly is cheaper than either.
 *
 * This is behaviour, and it is allowed to be, because it is derived from the
 * scope rather than read out of the persona's own telos text. The rule the
 * identity lines obey is that a persona may not argue with how the assistant
 * behaves; a fact about what it can reach is not an argument.
 */
export function limitsOf(
  capabilities: string[] | null | undefined
): string | null {
  if (capabilities == null) return null;

  const changes = capabilities
    .map((capability) => CHANGES_BY_CAPABILITY[capability])
    .filter(Boolean);

  if (!changes.length) {
    return (
      'You can read this project and nothing else. You cannot create or ' +
      'change anything on it. If you are asked to, say plainly that it is ' +
      'not something you can do, and do not pretend otherwise.'
    );
  }

  return (
    `You can read this project, and propose changes to ${asList(changes)}. ` +
    'Anything else is not something you can do, and if you are asked for it, ' +
    'say so rather than pretending otherwise.'
  );
}

/** How the assistant's own persona is recognised among the seeded ones. */
const DOES_PROJECT_WORK = /project manage/i;

@Injectable()
export class PersonaVoiceService {
  private readonly logger = new Logger(PersonaVoiceService.name);

  /** Personas change about never, and a run already costs a minute. */
  private readonly cache = new Map<string, { at: number; voice: Voice }>();
  private static readonly CACHE_MS = 5 * 60 * 1000;

  /**
   * Long enough for a cold service, short enough that a missing one costs a
   * pause rather than the answer. Without a persona the assistant still works.
   */
  private static readonly ASK_MS = 4000;

  constructor(
    @Inject(ServiceTokens.TELOS_DOCS_SERVICE)
    private readonly telos: ClientProxy
  ) {}

  /**
   * The persona to speak as, or null to speak as nobody.
   *
   * Null is a working answer rather than a failure. A nameless assistant that
   * responds beats a named one that cannot, so every path out of here that
   * cannot produce a persona produces null and says why in the log.
   */
  async voiceFor(personaId: string | null): Promise<Voice | null> {
    const key = personaId ?? '(the usual one)';
    const held = this.cache.get(key);
    if (held && Date.now() - held.at < PersonaVoiceService.CACHE_MS) {
      return held.voice;
    }

    try {
      const persona = personaId
        ? await this.byId(personaId)
        : await this.theOneWhoRunsProjects();
      if (!persona) {
        this.logger.warn(`No persona found for ${key}, speaking as nobody`);
        return null;
      }

      const voice = this.voiceOf(persona);
      this.cache.set(key, { at: Date.now(), voice });
      return voice;
    } catch (error) {
      this.logger.warn(
        `Could not read a persona (${
          (error as Error).message
        }), speaking as nobody`
      );
      return null;
    }
  }

  private async byId(id: string): Promise<PersonaTelos | null> {
    const found = await firstValueFrom(
      this.telos
        .send<PersonaTelos>({ cmd: PersonaTelosCommands.FIND_ONE }, { id })
        .pipe(timeout(PersonaVoiceService.ASK_MS))
    );
    return found?.id ? found : null;
  }

  /**
   * The default, chosen by what a persona is for rather than by a hardcoded id.
   *
   * An id would differ per environment and a name would break the moment
   * somebody renamed her. What is stable is the job: exactly one seeded persona
   * exists to help run projects.
   */
  private async theOneWhoRunsProjects(): Promise<PersonaTelos | null> {
    const all = await firstValueFrom(
      this.telos
        .send<PersonaTelos[]>({ cmd: PersonaTelosCommands.FIND }, {})
        .pipe(timeout(PersonaVoiceService.ASK_MS))
    );

    return (
      (all ?? []).find(
        (persona) =>
          DOES_PROJECT_WORK.test(persona.coreObjective ?? '') ||
          DOES_PROJECT_WORK.test(persona.description ?? '')
      ) ?? null
    );
  }

  /**
   * A telos turned into a voice, taking identity and leaving behaviour behind.
   *
   * Deliberately not read: `promptTemplate`, `exampleResponses`, `goals`,
   * `objectives` and `limitations`. Every one of them is an instruction about
   * what to do, written when these personas answered questions rather than
   * acted on a project. Patricia's examples are "here's a template for your
   * project plan" and her limitations say her advice is not project-specific,
   * which is the opposite of what she does here and exactly the behaviour that
   * three prompt rewrites failed to remove.
   *
   * What is read is who they are: their name, what they are, what they are
   * good at and what they care about.
   */
  private voiceOf(persona: PersonaTelos): Voice {
    const description = (persona.description ?? '').trim();
    const strengths = (persona.strengths ?? []).filter(Boolean);
    const interests = (persona.interests ?? []).filter(Boolean);

    const identityLines = [
      `You are ${persona.name}.`,
      ...(description ? [description] : []),
      ...(strengths.length
        ? [`You come across as ${asList(strengths).toLowerCase()}.`]
        : []),
      ...(interests.length
        ? [`You care about ${asList(interests).toLowerCase()}.`]
        : []),
    ];

    return {
      id: persona.id,
      name: persona.name,
      blurb: description || persona.coreObjective || '',
      identityLines,
      limits: limitsOf(persona.capabilities),
      tools: toolsFor(persona.capabilities),
    };
  }
}

/** "a, b and c", so a prompt reads as a sentence rather than a field dump. */
export function asList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
