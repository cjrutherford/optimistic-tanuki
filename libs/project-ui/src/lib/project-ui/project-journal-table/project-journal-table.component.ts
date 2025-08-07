import { ButtonComponent, ModalComponent, TableCell, TableComponent, TableRowAction } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output, SimpleChange, SimpleChanges, signal } from '@angular/core';
import { CreateProjectJournal, ProjectJournal } from '@optimistic-tanuki/ui-models';

import { CommonModule } from '@angular/common';
import { ProjectJournalFormComponent } from '../project-journal-form/project-journal-form.component';

@Component({
  standalone: true,
  selector: 'lib-project-journal-table',
  imports: [CommonModule, TableComponent, ButtonComponent, ModalComponent, ProjectJournalFormComponent],
  templateUrl: './project-journal-table.component.html',
  styleUrl: './project-journal-table.component.scss',
})
export class ProjectJournalTableComponent {
  cells = signal<TableCell[][]>([]);
  showModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  selectedJournal = signal<ProjectJournal | null>(null);
  @Output() createJournalEntry: EventEmitter<CreateProjectJournal> = new EventEmitter<CreateProjectJournal>();
  @Output() editJournalEntry: EventEmitter<ProjectJournal> = new EventEmitter<ProjectJournal>();
  @Output() deleteJournalEntry: EventEmitter<string> = new EventEmitter<string>();
  tableActions: TableRowAction[] = [
    {
      title: 'View',
      action: (index: number) => {
        console.log('View action for row:', index);
      },
    },
    {
      title: 'Edit',
      action: (index: number) => {
        console.log('Edit action for row:', index);
        this.selectedJournal.set(this.journals[index]);
        this.showEditModal.set(true);
        console.log('Selected journal for editing:', this.selectedJournal());
      },
    },
    {
      title: 'Delete',
      action: (index: number) => {
        console.log('Delete action for row:', index);
        this.deleteJournalEntry.emit(this.journals[index].id);
      },
    }
  ];
  @Input() journals: ProjectJournal[] = [
    {
      id: '1',
      projectId: 'project-1',
      profileId: 'profile-1',
      content: 'Initial project setup completed. This is a very long content entry that should overflow the cell to demonstrate how overflow is handled in the table component. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
      createdAt: new Date('2024-06-01'),
      analysis: 'Project is on track, but there are several considerations to keep in mind. The analysis section is intentionally verbose and lengthy to ensure it overflows the cell. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas.',
      updatedAt: new Date('2024-06-01'),
      updatedBy: 'admin',
    },{
      id: '2',
      projectId: 'project-1',
      profileId: 'profile-2',
      content: 'First sprint planning meeting held. The discussion was extensive and covered many topics, including backlog grooming, sprint goals, and resource allocation. This content is intentionally long to cause overflow in the table cell.',
      createdAt: new Date('2024-06-02'),
      analysis: 'Team is aligned on goals, but there are some risks identified. This analysis is also intentionally long to demonstrate overflow behavior in the UI. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae.',
      updatedAt: new Date('2024-06-02'),
      updatedBy: 'admin',
    },{
      id: '3',
      projectId: 'project-2',
      profileId: 'profile-1',
      content: 'Design phase completed. The documentation and diagrams are comprehensive and detailed, spanning multiple pages. This content is made long to test overflow handling in the table.',
      createdAt: new Date('2024-06-03'),
      analysis: 'Ready for development phase. All stakeholders have reviewed and approved the designs. This analysis is intentionally verbose to ensure overflow occurs in the table cell.',
      updatedAt: new Date('2024-06-03'),
      updatedBy: 'admin',
    }
  ];

  ngOnInit() {
    this.initCellularData();
  }
  ngOnChanges(changes: SimpleChanges) {
    if (changes['journals']) {
      this.initCellularData();
    }
  }

  private initCellularData() {
    const currentCells = this.journals?.map(journal => {
      return [
        {
          heading: 'Content',
          value: journal.content,
          isOverflowable: true,
        },
        {
          heading: 'Analysis',
          value: journal.analysis,
          isOverflowable: true,
        },
        {
          heading: 'Created At',
          value: new Date(journal.createdAt)?.toLocaleDateString(),
        },
        {
          heading: 'Updated At',
          value: new Date(journal.updatedAt || new Date())?.toLocaleDateString(),
        },
      ];
    }) || [];
    this.cells.set(currentCells);
  }

  setShowModal(index?: number) {
    this.showModal.set(true);
    if (index !== undefined) {
      const journal = this.journals[index];
      // Logic to populate the modal with the selected journal details
      console.log('Selected journal:', journal);
    }
  }

  entryUpdated(updatedEntry: Partial<ProjectJournal>) {
    const projectId = this.selectedJournal()?.projectId || '';
    const journalId = this.selectedJournal()?.id || '';
    const profileId = this.selectedJournal()?.profileId || '';
    const updateEntry: ProjectJournal = {
      id: journalId,
      projectId: projectId,
      profileId: profileId,
      ...this.selectedJournal(),
      ...updatedEntry,
      content: updatedEntry.content || this.selectedJournal()?.content || '',
      createdAt: this.selectedJournal()?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.editJournalEntry.emit(updateEntry);
    this.showEditModal.set(false);
    this.selectedJournal.set(null);
  }

  entryCreated(newEntry: Partial<ProjectJournal>) {
    const newJournal: CreateProjectJournal = {
      projectId: newEntry.projectId || '',
      profileId: newEntry.profileId || '',
      content: newEntry.content || '',
      createdAt: newEntry.createdAt || new Date(),
    };
    this.createJournalEntry.emit(newJournal);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
