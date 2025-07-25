import { ButtonComponent, TableCell, TableComponent, TableRowAction } from '@optimistic-tanuki/common-ui';
import { Component, Input, signal } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ModalComponent } from 'libs/common-ui/src/lib/common-ui/modal/modal.component';
import { Risk } from '@optimistic-tanuki/ui-models';
import { RiskFormComponent } from '../risk-form/risk-form.component';

@Component({
  selector: 'lib-risks-table',
  imports: [CommonModule, TableComponent, ButtonComponent, ModalComponent, RiskFormComponent],
  templateUrl: './risks-table.component.html',
  styleUrl: './risks-table.component.scss',
})
export class RisksTableComponent {
  cells = signal<TableCell[][]>([]);
  showModal = signal<boolean>(false);
  tableActions = signal<TableRowAction[]>([
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
  ]);

  @Input() risks: Risk[] = [
    {
      id: '1',
      description: 'Description for Risk 1',
      impact: 'HIGH',
      likelihood: 'LIKELY',
      projectId: '',
      status: 'OPEN',
      createdBy: '',
      createdAt: new Date('2024-06-01')
    },
    {
      id: '2',
      description: 'Description for Risk 2',
      impact: 'LOW',
      likelihood: 'POSSIBLE',
      createdBy: '',
      createdAt: new Date('2024-06-01'),
      projectId: '',
      status: 'IN_PROGRESS',
    },
    {
      id: '3',
      description: 'Description for Risk 3',
      impact: 'MEDIUM',
      likelihood: 'CERTAIN',
      projectId: '',
      status: 'OPEN',
      createdBy: '',
      createdAt: new Date('2024-06-01')
    },
  ];


  ngOnInit() {
    const currentCells = this.risks.map((risk, index) => [
      { id: risk.id, heading: 'Description', value: risk.description, index },
      { id: risk.id, heading: 'Impact', value: risk.impact, index },
      { id: risk.id, heading: 'Likelihood', value: risk.likelihood, index },
      { id: risk.id, heading: 'Status', value: risk.status, index },
      { id: risk.id, heading: 'Created By', value: risk.createdBy, index },
      { id: risk.id, heading: 'Created At', value: risk.createdAt.toLocaleDateString(), index },
    ]);
    this.cells.set(currentCells);
  }

  setShowModal(index?: number) {
    this.showModal.set(true);
    if (index !== undefined) {
      const risk = this.risks[index];
      // Logic to populate the modal with the selected risk details
      console.log('Selected risk:', risk);
    }
  }

  closeModal() {
    this.showModal.set(false);
  }
}
