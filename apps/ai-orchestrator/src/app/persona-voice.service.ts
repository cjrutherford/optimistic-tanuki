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
   * The tools this persona may reach, or null for all of them.
   *
   * Always null today. It is here rather than added later because choosing a
   * persona is meant to choose what can be done, so every caller that binds
   * tools should be reading a scope from the outset. Filling it in is its own
   * piece of work; leaving the seam out would mean building it twice.
   */
  tools: string[] | null;
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
      tools: null,
    };
  }
}

/** "a, b and c", so a prompt reads as a sentence rather than a field dump. */
export function asList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
