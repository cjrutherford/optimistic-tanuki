import { ButtonComponent, ModalComponent, TableCell, TableComponent, TableRowAction } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { CreateRisk, Risk } from '@optimistic-tanuki/ui-models';

import { CommonModule } from '@angular/common';
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
  @Output() createRisk: EventEmitter<CreateRisk> = new EventEmitter<CreateRisk>();
  @Output() editRisk: EventEmitter<Risk> = new EventEmitter<Risk>();
  @Output() deleteRisk: EventEmitter<string> = new EventEmitter<string>();
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
        this.editRisk.emit(this.risks[index]);
        this.setShowModal(index);
      },
    },
    {
      title: 'Delete',
      action: (index: number) => {
        console.log('Delete action for row:', index);
        this.deleteRisk.emit(this.risks[index].id);
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
    this.setCellularData();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['risks']) {
      console.log('Risks changed:', changes['risks'].currentValue);
      this.setCellularData();
    }
  }

  private setCellularData() {
    const currentCells = this.risks?.map((risk, index) => [
      { id: risk.id, heading: 'Description', value: risk.description, index },
      { id: risk.id, heading: 'Impact', value: risk.impact, index },
      { id: risk.id, heading: 'Likelihood', value: risk.likelihood, index },
      { id: risk.id, heading: 'Status', value: risk.status, index },
      { id: risk.id, heading: 'Created By', value: risk.createdBy, index },
      { id: risk.id, heading: 'Created At', value: new Date(risk.createdAt)?.toLocaleDateString(), index },
    ]) || [];
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

  onCreateFormSubmit(risk: CreateRisk) {
    console.log('Creating risk with data:', risk);
    this.createRisk.emit(risk);
    this.closeModal();
  }

  closeModal() {
    this.showModal.set(false);
  }
}
