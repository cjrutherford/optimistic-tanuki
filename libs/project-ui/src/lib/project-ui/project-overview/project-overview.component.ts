import { ButtonComponent, CardComponent, TileComponent } from '@optimistic-tanuki/common-ui';
import { Component, Input, signal } from '@angular/core';

import { ChangesTableComponent } from '../changes-table/changes-table.component';

import { Project } from '@optimistic-tanuki/ui-models';
import { ProjectJournalTableComponent } from '../project-journal-table/project-journal-table.component';
import { RisksTableComponent } from '../risks-table/risks-table.component';
import { SummaryBlockComponent } from '../summary-block/summary-block.component';
import { TasksTableComponent } from '../tasks-table/tasks-table.component';

@Component({
  selector: 'lib-project-overview',
  imports: [
    CardComponent,
    SummaryBlockComponent,
    TileComponent,
    ButtonComponent,
    ProjectJournalTableComponent,
    TasksTableComponent,
    RisksTableComponent,
    ChangesTableComponent
],
  templateUrl: './project-overview.component.html',
  styleUrl: './project-overview.component.scss',
})
export class ProjectOverviewComponent {
  detailsShown = signal<boolean>(false);
  projectName = signal<string>('Project Name');
  taskCount = signal<number>(0);
  riskCount = signal<number>(0);
  changeCount = signal<number>(0);
  shownDetails = signal<'tasks' | 'risks' | 'changes' | 'journal'>('tasks');

  @Input() project: Project = {
    id: '1',
    name: 'Project Alpha',
    owner: 'John Doe',
    members: ['Alice', 'Bob'],
    createdBy: 'John Doe',
    createdAt: new Date(),
    description: 'This is the first project.',
    startDate: new Date('2023-01-01'),
    endDate: new Date('2023-12-31'),
    status: 'active',
    tasks: [],
    risks: [],
    changes: [],
    journalEntries: [],
    timers: [],
  };

  ngOnInit() {
    if (this.project) {
      this.projectName.set(this.project.name);
    }
    if (this.project.tasks) {
      this.taskCount.set(this.project.tasks.filter(t => !['DONE', 'ARCHIVED'].includes(t.status)).length);
    }
    if (this.project.risks) {
      this.riskCount.set(this.project.risks.filter(r => r.status !== 'CLOSED').length);
    }
    if (this.project.changes) {
      this.changeCount.set(this.project.changes.filter(c => !['COMPLETE', 'DISCARDED'].includes(c.changeStatus)).length);
    }
  }

  showDetails(details: 'tasks' | 'risks' | 'changes' | 'journal'): void {
    this.shownDetails.set(details);
    this.detailsShown.set(true);
  }
  hideDetails(): void {
    this.detailsShown.set(false);
    this.shownDetails.set('tasks');
  }
}
