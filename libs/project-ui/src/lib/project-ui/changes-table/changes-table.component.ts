import { ButtonComponent, ModalComponent, TableCell, TableComponent, TableRowAction } from '@optimistic-tanuki/common-ui';
import { Component, Input, signal } from '@angular/core';

import { Change } from '@optimistic-tanuki/ui-models';
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
    },
  },
  {
    title: 'Delete',
    action: (index: number) => {
      console.log('Delete action for row:', index);
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
    const currentCells: TableCell[][] = this.changes?.map((change, index) => [
      { id: change.id, heading: 'Change Description', value: change.changeDescription },
      { id: change.id, heading: 'Change Type', value: change.changeType },
      { id: change.id, heading: 'Change Date', value: change.changeDate.toLocaleDateString() },
      { id: change.id, heading: 'Requestor', value: change.requestor },
      { id: change.id, heading: 'Approver', value: change.approver },
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
}
