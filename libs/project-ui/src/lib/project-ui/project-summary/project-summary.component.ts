import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Project, Task, Risk, Change } from '@optimistic-tanuki/ui-models';

export type ProjectSummaryEntity = 'tasks' | 'risks' | 'changes' | 'journal';

interface Activity {
  date: Date;
  type: ProjectSummaryEntity;
  label: string;
  title: string;
}

@Component({
  selector: 'lib-project-summary',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-summary.component.html',
  styleUrl: './project-summary.component.scss',
})
export class ProjectSummaryComponent {
  @Input() project!: Project;
  @Output() entitySelected = new EventEmitter<ProjectSummaryEntity>();

  get activeTasks(): Task[] {
    return (this.project?.tasks ?? []).filter(
      (task) => !['DONE', 'ARCHIVED'].includes(task.status)
    );
  }

  get overdueTasks(): Task[] {
    const now = new Date();
    return this.activeTasks.filter(
      (task) => task.dueDate && new Date(task.dueDate) < now
    );
  }

  get highPriorityTasks(): Task[] {
    return this.activeTasks.filter((task) =>
      ['HIGH', 'MEDIUM_HIGH'].includes(task.priority)
    );
  }

  get unresolvedRisks(): Risk[] {
    return (this.project?.risks ?? []).filter(
      (risk) => risk.status !== 'CLOSED'
    );
  }

  get pendingChanges(): Change[] {
    return (this.project?.changes ?? []).filter(
      (change) => !['COMPLETE', 'DISCARDED'].includes(change.changeStatus)
    );
  }

  get blockers(): number {
    return (
      this.overdueTasks.length +
      this.unresolvedRisks.filter((risk) => risk.impact === 'HIGH').length
    );
  }

  get trackedSeconds(): number {
    return (this.project?.tasks ?? []).reduce(
      (total, task) => total + (task.totalTimeSeconds ?? 0),
      0
    );
  }

  get noteCount(): number {
    return (
      (this.project?.journalEntries?.length ?? 0) +
      (this.project?.tasks ?? []).reduce(
        (count, task) => count + (task.notes?.length ?? 0),
        0
      )
    );
  }

  get activity(): Activity[] {
    const entries: Activity[] = [
      ...(this.project?.tasks ?? []).map((task) => ({
        date: new Date(task.createdAt),
        type: 'tasks' as const,
        label: 'Task created',
        title: task.title,
      })),
      ...(this.project?.risks ?? []).map((risk) => ({
        date: new Date(risk.createdAt),
        type: 'risks' as const,
        label: 'Risk recorded',
        title: risk.description,
      })),
      ...(this.project?.changes ?? []).map((change) => ({
        date: new Date(change.changeDate),
        type: 'changes' as const,
        label: 'Change proposed',
        title: change.changeDescription,
      })),
      ...(this.project?.journalEntries ?? []).map((entry) => ({
        date: new Date(entry.createdAt),
        type: 'journal' as const,
        label: 'Journal entry',
        title: entry.content,
      })),
      ...(this.project?.tasks ?? []).flatMap((task) =>
        (task.notes ?? []).map((note) => ({
          date: new Date(note.createdAt),
          type: 'tasks' as const,
          label: 'Task note',
          title: `${task.title}: ${note.content}`,
        }))
      ),
    ];

    return entries
      .filter((entry) => !Number.isNaN(entry.date.getTime()))
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 6);
  }

  get nextAction(): string {
    if (this.overdueTasks.length) {
      return `Resolve ${this.overdueTasks[0].title}`;
    }
    if (this.unresolvedRisks.length) {
      return `Review risk: ${this.unresolvedRisks[0].description}`;
    }
    if (this.pendingChanges.length) {
      return `Review change: ${this.pendingChanges[0].changeDescription}`;
    }
    return this.activeTasks.length
      ? `Start ${this.activeTasks[0].title}`
      : 'Add the first task to establish momentum';
  }

  formatTime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  select(entity: ProjectSummaryEntity): void {
    this.entitySelected.emit(entity);
  }
}
