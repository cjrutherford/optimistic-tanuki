import { Injectable, computed, inject, signal } from '@angular/core';
import {
  AssistantContextService,
  AssistantTurn,
} from '@optimistic-tanuki/project-ui';
import { ProjectService } from '../project/project.service';

/**
 * The one conversation, wherever it is opened from.
 *
 * The thread used to live on the projects page, so it began again every time
 * somebody navigated away. Holding it here means the assistant is the same
 * assistant on every page, and the project it is working on travels with it
 * rather than being an argument the page has to supply.
 */
@Injectable({ providedIn: 'root' })
export class AssistantService {
  private readonly projects = inject(ProjectService);
  private readonly context = inject(AssistantContextService);

  private readonly conversation = signal<AssistantTurn[]>([]);
  private readonly busy = signal(false);
  private readonly tools = signal<string[]>([]);

  readonly turns = this.conversation.asReadonly();
  readonly working = this.busy.asReadonly();
  readonly doing = this.tools.asReadonly();
  readonly projectName = computed(() => this.context.project()?.name ?? null);

  /** Set when a run finishes, so a page can refresh what it is showing. */
  readonly lastResult = signal<{
    awaitingApproval: boolean;
    used: { tool: string; result: string }[];
  } | null>(null);

  clear(): void {
    this.conversation.set([]);
    this.tools.set([]);
  }

  ask(question: string): void {
    if (this.busy()) return;

    const history = this.conversation().map((turn) => ({
      role: turn.role,
      text: turn.text,
    }));
    this.conversation.update((turns) => [
      ...turns,
      { role: 'person', text: question },
    ]);
    this.busy.set(true);
    this.tools.set([]);

    // Whatever project the reader is on, or nothing at all. With nothing, the
    // assistant starts by finding out what projects there are.
    const projectId = this.context.project()?.id ?? null;

    this.projects
      .instructAssistantStreaming(projectId, question, history, (event) => {
        if (event.type === 'tool') {
          this.tools.update((used) => [...used, event.tool]);
          return;
        }
        this.finish(event.result);
      })
      .catch(() => {
        this.busy.set(false);
        this.tools.set([]);
        this.conversation.update((turns) => [
          ...turns,
          {
            role: 'assistant',
            text: 'The assistant could not be reached.',
            failed: true,
          },
        ]);
      });
  }

  private finish(result: {
    said: string;
    used: { tool: string; result: string }[];
    awaitingApproval: boolean;
    unavailable?: string;
  }): void {
    this.busy.set(false);
    this.tools.set([]);
    this.conversation.update((turns) => [
      ...turns,
      {
        role: 'assistant',
        text:
          result.said ||
          result.unavailable ||
          'It finished without saying anything.',
        used: result.used,
        awaitingApproval: result.awaitingApproval,
        failed: !!result.unavailable,
      },
    ]);
    this.lastResult.set({
      awaitingApproval: result.awaitingApproval,
      used: result.used ?? [],
    });
  }
}
