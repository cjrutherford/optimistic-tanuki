import { ButtonComponent, ModalComponent, TableCell, TableComponent, TableRowAction } from '@optimistic-tanuki/common-ui';
import { Change, CreateChange } from '@optimistic-tanuki/ui-models';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';

import { ChangeFormComponent } from '../change-form/change-form.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'lib-changes-table',
  imports: [CommonModule, TableComponent, ButtonComponent, ModalComponent, ChangeFormComponent],
  templateUrl: './changes-table.component.html',
  styleUrl: './changes-table.component.scss',
})
export class ChangesTableComponent {
  cells = signal<TableCell[][]>([])
  showModal = signal<boolean>(false);
  showEditModal = signal<boolean>(false);
  selectedChange = signal<Change | null>(null);
  @Output() createChange: EventEmitter<CreateChange> = new EventEmitter<CreateChange>();
  @Output() editChange: EventEmitter<Change> = new EventEmitter<Change>();
  @Output() deleteChange: EventEmitter<string> = new EventEmitter<string>();
  @Input() changes: Change[] = [
    {
      id: '1',
      changeDescription: 'Description for Change 1',
      changeType: 'ADDITION',
      changeStatus: 'PENDING',
      changeDate: new Date('2024-06-01'),
      requestor: 'Alice',
      approver: 'Bob',
      resolution: 'PENDING',
      projectId: 'project-1',
      updatedBy: 'admin',
      updatedAt: new Date('2024-06-01')
    },
    {
      id: '2',
      changeDescription: 'Description for Change 2',
      changeType: 'MODIFICATION',
      changeStatus: 'PENDING',
      changeDate: new Date('2024-06-01'),
      requestor: 'Alice',
      approver: 'Bob',
      resolution: 'PENDING',
      projectId: 'project-2',
      updatedBy: 'admin',
      updatedAt: new Date('2024-06-01')
    },
    {
      id: '3',
      changeDescription: 'Description for Change 3',
      changeType: 'MODIFICATION',
      changeStatus: 'PENDING',
      changeDate: new Date('2024-06-01'),
      requestor: 'Alice',
      approver: 'Bob',
      resolution: 'PENDING',
      projectId: 'project-3',
      updatedBy: 'admin',
      updatedAt: new Date('2024-06-01')
    },
  ]

  rowActions: TableRowAction[] = [
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
      this.selectedChange.set(this.changes[index]);
      this.showEditModal.set(true);
      console.log('Selected change for editing:', this.selectedChange());
    },
  },
  {
    title: 'Delete',
    action: (index: number) => {
      console.log('Delete action for row:', index);
      const change = this.changes[index];
      this.deleteChange.emit(change.id);
    },
  },
  {
    title: 'Approve',
    action: (index: number) => {
      console.log('Approve action for row:', index);
    },
  },
  {
    title: 'Reject',
    action: (index: number) => {
      console.log('Reject action for row:', index);
    },
  },
  {
    title: 'Request More Info',
    action: (index: number) => {
      console.log('Request More Info action for row:', index);
    },
  },
  ]

  ngOnInit() {
    console.log('ChangesTableComponent initialized');
    this.setCellularData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['changes']) {
      console.log('Changes changed:', changes['changes'].currentValue);
      this.setCellularData();
    }
  }

  private setCellularData() {
    const currentCells: TableCell[][] = this.changes?.map((change, index) => [
      { id: change.id, heading: 'Change Description', value: change.changeDescription },
      { id: change.id, heading: 'Change Type', value: change.changeType },
      { id: change.id, heading: 'Change Date', value: new Date(change.changeDate)?.toLocaleDateString() },
      { id: change.id, heading: 'Requestor', value: change.requestor },
      { id: change.id, heading: 'Approver', value: change.approver },
      { id: change.id, heading: 'Change Status', value: change.changeStatus },
      { id: change.id, heading: 'Updated By', value: change.updatedBy },
      { id: change.id, heading: 'Updated At', value: new Date(change.updatedAt!).toLocaleDateString() },
      { id: change.id, heading: 'Resolution', value: change.resolution },
    ]) || [];
    this.cells.set(currentCells);
  }

  setShowModal(index?: number) {
    this.showModal.set(true);
    if (index !== undefined) {
      const change = this.changes[index];
      // Logic to populate the modal with the selected change details
      console.log('Selected change:', change);
    }
  }
  closeModal() {
    console.log("Closing modal")
    this.showModal.set(false);
  }

  onCreateFormSubmit(change: Partial<Change>) {
    console.log('Creating change with data:', change);
    const {
      changeType = 'ADDITION',
      changeDescription = '',
      changeStatus = 'PENDING',
      changeDate = new Date(),
      requestor = '',
      approver = '',
      resolution = 'PENDING',
      projectId = ''
    } = change;
    const newChange: CreateChange = {
      changeType,
      changeDescription,
      changeStatus,
      changeDate,
      requestor,
      approver,
      resolution,
      projectId
    }
    this.createChange.emit(newChange);
    this.closeModal();
  }

  onEditFormSubmit(change: Partial<Change>) {
    console.log('Editing change:', change);
    const selected = this.selectedChange();
    const changeId = selected?.id || '';
    const updatedChange: Change = {
      ...selected,
      ...change,
      id: changeId,
      updatedAt: new Date(),
      projectId: selected?.projectId ?? '', 
      changeType: selected?.changeType ?? 'ADDITION', 
      changeStatus: selected?.changeStatus ?? 'PENDING', 
      changeDescription: selected?.changeDescription ?? '',
      requestor: selected?.requestor ?? '',
      approver: selected?.approver ?? '', 
      resolution: selected?.resolution ?? 'PENDING', 
      updatedBy: selected?.updatedBy ?? '', 
      changeDate: selected?.changeDate ?? new Date(),
    };
    this.editChange.emit(updatedChange);
    this.showEditModal.set(false);
  }
}
