import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AssistantContextService,
  AssistantTurn,
} from '@optimistic-tanuki/project-ui';
import { ProjectService } from '../project/project.service';

/** Who is being spoken to, as much as this needs to know. */
export interface ChosenPersona {
  id: string;
  name: string;
}

/** Where the last choice is kept, so the same person opens next time. */
const REMEMBERED = 'forgeofwill.assistant.persona';

/**
 * The conversations, wherever they are opened from.
 *
 * The thread used to live on the projects page, so it began again every time
 * somebody navigated away. Holding it here means the assistant is the same
 * assistant on every page, and the project it is working on travels with it
 * rather than being an argument the page has to supply.
 *
 * There is now one thread per persona rather than one thread. Switching used
 * to be impossible and, once it was possible, the obvious cheap version of it
 * was to keep talking in the same thread under a new name. That is worse than
 * it looks: the whole thread is replayed to the model on every turn, so one
 * mixed thread feeds each persona words another persona said, and the panel
 * shows one name above turns somebody else produced. Keeping them apart costs
 * a Map.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly projects = inject(ProjectService);
  private readonly context = inject(AssistantContextService);

  /** Keyed by persona id, or by the empty string before anyone is chosen. */
  private readonly threads = signal<Record<string, AssistantTurn[]>>({});
  private readonly speaking = signal<ChosenPersona | null>(readRemembered());
  private readonly busy = signal(false);
  private readonly tools = signal<string[]>([]);
  /** The answer so far, while it is being written. */
  private readonly streaming = signal('');
  /** What it is chewing on, while it works. Never shown as the answer. */
  private readonly musing = signal('');

  readonly persona = this.speaking.asReadonly();
  readonly working = this.busy.asReadonly();
  readonly doing = this.tools.asReadonly();
  readonly partial = this.streaming.asReadonly();
  readonly thinking = this.musing.asReadonly();
  readonly projectName = computed(() => this.context.project()?.name ?? null);

  /** The thread of whoever is being spoken to now. */
  readonly turns = computed(() => this.threads()[this.key()] ?? []);

  /** Set when a proposal is answered, so a page can refresh its board. */
  readonly decided = signal<{ id: string; approved: boolean } | null>(null);

  /** Set when a run finishes, so a page can refresh what it is showing. */
  readonly lastResult = signal<{
    awaitingApproval: boolean;
    used: { tool: string; result: string }[];
  } | null>(null);

  /**
   * Speak to somebody else.
   *
   * Their thread is opened rather than the current one being relabelled, and
   * coming back finds the first one as it was left. A switch part-way through
   * a run is ignored, because the answer still in flight belongs to the
   * persona who was asked.
   */
  speakTo(persona: ChosenPersona | null): void {
    if (this.busy()) return;
    this.speaking.set(persona);
    this.tools.set([]);
    this.streaming.set('');
    this.musing.set('');
    remember(persona);
  }

  /** Clears the open thread only. Other personas keep theirs. */
  clear(): void {
    const key = this.key();
    this.threads.update((all) => ({ ...all, [key]: [] }));
    this.tools.set([]);
    this.streaming.set('');
    this.musing.set('');
  }

  ask(question: string): void {
    if (this.busy()) return;

    const key = this.key();
    const history = (this.threads()[key] ?? []).map((turn) => ({
      role: turn.role,
      text: turn.text,
    }));
    this.append(key, { role: 'person', text: question });
    this.busy.set(true);
    this.tools.set([]);
    this.streaming.set('');
    this.musing.set('');

    // Whatever project the reader is on, or nothing at all. With nothing, the
    // assistant starts by finding out what projects there are.
    const projectId = this.context.project()?.id ?? null;
    const personaId = this.speaking()?.id ?? null;

    this.projects
      .instructAssistantStreaming(
        projectId,
        question,
        history,
        (event) => {
          if (event.type === 'tool') {
            this.tools.update((used) => [...used, event.tool]);
            return;
          }
          if (event.type === 'text') {
            this.streaming.update((so) => so + event.chunk);
            return;
          }
          if (event.type === 'thinking') {
            this.musing.update((so) => keepTheTail(so + event.chunk));
            return;
          }
          // Answered into the thread it was asked in, which is not necessarily
          // the one open by the time it arrives.
          this.finish(key, event.result);
        },
        personaId
      )
      .catch(() => {
        this.busy.set(false);
        this.tools.set([]);
        this.streaming.set('');
        this.musing.set('');
        this.append(key, {
          role: 'assistant',
          text: 'The assistant could not be reached.',
          failed: true,
        });
      });
  }

  /**
   * Answer a proposal from inside the conversation.
   *
   * The same gateway route the projects page calls, so there is one approval
   * path rather than two implementations that can disagree about what
   * approving means. The panel says what happened rather than silently
   * removing the buttons, because a proposal that vanishes is
   * indistinguishable from one that was never there.
   */
  decide(id: string, approved: boolean): void {
    const key = this.key();
    this.projects
      .reviewAiChange({ id, status: approved ? 'APPROVED' : 'REJECTED' })
      .subscribe({
        next: () => {
          this.append(key, {
            role: 'assistant',
            text: approved
              ? 'Approved. It has been applied to the project.'
              : 'Rejected. Nothing was changed.',
          });
          this.decided.set({ id, approved });
        },
        error: () => {
          this.append(key, {
            role: 'assistant',
            text: 'That could not be recorded. Nothing has changed.',
            failed: true,
          });
        },
      });
  }

  /** The persona whose thread is open, or the one before anyone is chosen. */
  private key(): string {
    return this.speaking()?.id ?? '';
  }

  private append(key: string, turn: AssistantTurn): void {
    this.threads.update((all) => ({
      ...all,
      [key]: [...(all[key] ?? []), turn],
    }));
  }

  private finish(
    key: string,
    result: {
      said: string;
      used: { tool: string; result: string }[];
      awaitingApproval: boolean;
      unavailable?: string;
      spokenBy?: { id: string; name: string; blurb: string };
    }
  ): void {
    this.busy.set(false);
    this.tools.set([]);
    // Whatever was streamed is replaced by what actually arrived. They are
    // usually the same text, and are not when composing failed and the
    // agent's own words were used instead.
    this.streaming.set('');
    this.musing.set('');
    this.append(key, {
      role: 'assistant',
      text:
        result.said ||
        result.unavailable ||
        'It finished without saying anything.',
      used: result.used,
      awaitingApproval: result.awaitingApproval,
      failed: !!result.unavailable,
    });
    this.lastResult.set({
      awaitingApproval: result.awaitingApproval,
      used: result.used ?? [],
    });

    // Nobody was chosen, and the orchestrator picked its usual persona. Taking
    // its word for who answered means the panel can name them, and means the
    // next question carries the same id rather than being answered by whoever
    // the default happens to be at the time.
    if (!this.speaking() && result.spokenBy) {
      const answered = { id: result.spokenBy.id, name: result.spokenBy.name };
      this.speaking.set(answered);
      remember(answered);
      // The thread was built under the empty key, so it moves with them.
      this.threads.update((all) => {
        const { ['']: opening, ...rest } = all;
        return opening?.length ? { ...rest, [answered.id]: opening } : all;
      });
    }
  }
}

/**
 * The last stretch of what it is thinking, because the whole of it is long,
 * arrives faster than anybody reads, and is not the answer. A tail says it is
 * alive and what it is on without pretending to be worth reading in full.
 */
const THINKING_SHOWN = 240;

function keepTheTail(text: string): string {
  return text.length <= THINKING_SHOWN ? text : text.slice(-THINKING_SHOWN);
}

/**
 * Reading and writing the remembered choice, guarded because this app renders
 * on the server as well, where there is no localStorage and a throw would take
 * the page down rather than cost a preference.
 */
function readRemembered(): ChosenPersona | null {
  try {
    const held = globalThis.localStorage?.getItem(REMEMBERED);
    return held ? (JSON.parse(held) as ChosenPersona) : null;
  } catch {
    return null;
  }
}

function remember(persona: ChosenPersona | null): void {
  try {
    if (persona) {
      globalThis.localStorage?.setItem(REMEMBERED, JSON.stringify(persona));
    } else {
      globalThis.localStorage?.removeItem(REMEMBERED);
    }
  } catch {
    // A preference that cannot be saved is not worth a broken assistant.
  }
}
