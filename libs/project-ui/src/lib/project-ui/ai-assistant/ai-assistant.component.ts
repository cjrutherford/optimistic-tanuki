import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * The assistant, as something a person can actually talk to.
 *
 * What stood here was a placeholder: an empty component class and a template
 * that always read "AI assistant unavailable". It was the only assistant a
 * signed-in person ever saw, while the agent behind it worked and was reachable
 * from a single-line box buried in the approval panel.
 *
 * Two things it does that a chat window usually does not.
 *
 * It shows the tools the agent called, not only the sentence it wrote. A
 * person who reads "created a task, waiting for your approval" trusts it
 * differently from one reading a paragraph, and the agent's own account is the
 * one thing that cannot be trusted to reveal that nothing happened.
 *
 * It says plainly when something is waiting for approval, because on a project
 * that requires it nothing the assistant does reaches the board until somebody
 * agrees.
 */

export interface AssistantTurn {
  role: 'person' | 'assistant';
  text: string;
  /** Tools called while producing this turn, for the assistant's turns. */
  used?: { tool: string; result: string }[];
  awaitingApproval?: boolean;
  failed?: boolean;
}

@Component({
  selector: 'lib-ai-assistant',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-assistant.component.html',
  styleUrl: './ai-assistant.component.scss',
})
export class AiAssistantComponent {
  @Input() turns: AssistantTurn[] = [];
  /** True while the agent is working. It takes a while; say so. */
  @Input() working = false;
  /** Tools it has used so far this turn, as they happen. */
  @Input() doing: string[] = [];
  /** Set when there is no assistant to talk to, and why. */
  @Input() unavailable: string | null = null;
  /** What it is working on, so the panel can name it. */
  @Input() projectName: string | null = null;
  @Output() asked = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  draft = '';

  draftChanged(event: Event): void {
    this.draft = (event.target as HTMLTextAreaElement).value;
  }

  submit(): void {
    const question = this.draft.trim();
    if (!question || this.working || this.unavailable) return;
    this.asked.emit(question);
    this.draft = '';
  }

  /** Enter sends, shift-enter makes a new line, as anywhere else. */
  keyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit();
    }
  }

  /**
   * What to say while it works, given what it has done so far.
   *
   * A run takes a minute or more and the first stretch of it is genuinely
   * silent: the agent is deciding what to call before it calls anything. Once
   * tools start arriving there is something true to report, and reporting it
   * is the difference between waiting and watching.
   *
   * This becomes the thinking message when the panel moves onto the shared
   * chat window, so the wording is worth getting right here.
   */
  get thinkingMessage(): string {
    return this.doing.length
      ? 'Working on it. So far:'
      : 'Working on it. This takes a minute.';
  }

  /** The tool name, in words, so the list reads as actions rather than API. */
  describe(tool: string): string {
    const words: Record<string, string> = {
      list_projects: 'looked at your projects',
      get_project: 'read the project',
      query_tasks: 'searched the tasks',
      list_tasks: 'listed the tasks',
      create_task: 'proposed a new task',
      update_task: 'proposed a change to a task',
      delete_task: 'tried to delete a task',
      create_risk: 'proposed a risk',
      update_risk: 'proposed a change to a risk',
      create_change: 'proposed a change record',
      create_journal_entry: 'proposed a journal entry',
      list_risks: 'listed the risks',
      query_risks: 'searched the risks',
    };
    return words[tool] ?? tool.replace(/_/g, ' ');
  }

  /** True when a tool call was turned into a proposal rather than done. */
  wasProposed(call: { result: string }): boolean {
    return /waiting for approval/i.test(call.result);
  }

  /**
   * Whether the assistant only saw part of a list while answering this turn.
   *
   * A list tool returns a page and says whether there is more behind it. The
   * assistant is not told to mention that and usually does not, so an answer
   * drawn from the first twenty five of two hundred reads exactly like an
   * answer drawn from all of them. Saying so is the difference between a
   * limitation and a wrong answer nobody caught.
   *
   * Read from what the tools returned rather than from what the assistant
   * said, for the same reason the approval notice is: its own account is the
   * one source that cannot be trusted to reveal what it missed.
   */
  sawOnlyPartOfAList(turn: AssistantTurn): boolean {
    return (turn.used ?? []).some(
      (call) =>
        /"more"\s*:\s*true/.test(call.result) || /SHORTENED/.test(call.result)
    );
  }
}
