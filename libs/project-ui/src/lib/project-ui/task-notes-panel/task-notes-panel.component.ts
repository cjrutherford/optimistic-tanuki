import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TaskNote } from '@optimistic-tanuki/ui-models';

/**
 * Notes taken against a task, and a way to take one.
 *
 * The landing page has always promised notes "built into the flow". The
 * entity, the service, the routes and a client service all existed and no
 * screen anywhere used them, so the only way a note ever reached a task was
 * for the assistant to propose one and a person to approve it.
 *
 * Tasks are listed rather than notes, because a note out of the context of its
 * task is a sentence with no subject. Only the task being written on is opened,
 * so a busy project does not become a wall of prose.
 */

export interface NotableTask {
  id: string;
  title: string;
  status?: string;
}

@Component({
  selector: 'lib-task-notes-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './task-notes-panel.component.html',
  styleUrl: './task-notes-panel.component.scss',
})
export class TaskNotesPanelComponent {
  @Input() tasks: NotableTask[] = [];
  @Input() notes: TaskNote[] = [];
  /** The task whose note is mid-request, so its buttons can settle. */
  @Input() savingTaskId: string | null = null;
  @Output() noteAdded = new EventEmitter<{ taskId: string; content: string }>();

  openTaskId: string | null = null;
  drafts: Record<string, string> = {};

  notesFor(taskId: string): TaskNote[] {
    return this.notes
      .filter((note) => (note.task?.id ?? note.taskId) === taskId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
  }

  countFor(taskId: string): number {
    return this.notesFor(taskId).length;
  }

  /** Tasks carrying notes first: this panel is for reading as well as writing. */
  get ordered(): NotableTask[] {
    return [...this.tasks].sort(
      (a, b) => this.countFor(b.id) - this.countFor(a.id)
    );
  }

  get total(): number {
    return this.notes.length;
  }

  isOpen(taskId: string): boolean {
    return this.openTaskId === taskId;
  }

  toggle(taskId: string): void {
    this.openTaskId = this.isOpen(taskId) ? null : taskId;
  }

  draftChanged(taskId: string, event: Event): void {
    this.drafts[taskId] = (event.target as HTMLTextAreaElement).value;
  }

  add(taskId: string): void {
    const content = this.drafts[taskId]?.trim();
    if (!content || this.savingTaskId) return;
    this.noteAdded.emit({ taskId, content });
    this.drafts[taskId] = '';
  }
}
