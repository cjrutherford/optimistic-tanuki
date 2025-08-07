import { CommonModule } from "@angular/common";
import { Component, signal, Output, EventEmitter, Input, SimpleChanges } from "@angular/core";
import { TableComponent, ButtonComponent, ModalComponent, TableCell, TableRowAction } from "@optimistic-tanuki/common-ui";
import { Change, CreateChange } from "@optimistic-tanuki/ui-models";
import { ChangeFormComponent } from "../change-form/change-form.component";

/**
 * Component for displaying a table of changes.
 */
@Component({
  standalone: true,
  selector: 'lib-changes-table',
  imports: [CommonModule, TableComponent, ButtonComponent, ModalComponent, ChangeFormComponent],
  templateUrl: './changes-table.component.html',
  styleUrl: './changes-table.component.scss',
})
export class ChangesTableComponent {
  /**
   * Signal that holds the table cell data.
   */
  cells = signal<TableCell[][]>([])
  /**
   * Signal to control the visibility of the create/edit modal.
   */
  showModal = signal<boolean>(false);
  /**
   * Signal to control the visibility of the edit modal specifically.
   */
  showEditModal = signal<boolean>(false);
  /**
   * Signal that holds the currently selected change for editing.
   */
  selectedChange = signal<Change | null>(null);
  /**
   * Emits when a new change is to be created.
   */
  @Output() createChange: EventEmitter<CreateChange> = new EventEmitter<CreateChange>();
  /**
   * Emits when an existing change is to be edited.
   */
  @Output() editChange: EventEmitter<Change> = new EventEmitter<Change>();
  /**
   * Emits when a change is to be deleted.
   */
  @Output() deleteChange: EventEmitter<string> = new EventEmitter<string>();
  /**
   * Input property for the array of changes to display.
   */
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

  /**
   * Actions available for each row in the table.
   */
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

  /**
   * Initializes the component and sets up cellular data.
   */
  ngOnInit() {
    this.setCellularData();
  }

  /**
   * Handles changes to input properties and updates cellular data.
   * @param changes The SimpleChanges object containing changed properties.
   */
  ngOnChanges(changes: SimpleChanges) {
    if (changes['changes']) {
      this.setCellularData();
    }
  }

  /**
   * Sets the cellular data for the table based on the input changes.
   */
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

  /**
   * Sets the visibility of the create/edit modal.
   * @param index Optional index of the change to edit.
   */
  setShowModal(index?: number) {
    this.showModal.set(true);
    if (index !== undefined) {
      const change = this.changes[index];
      this.selectedChange.set(change);
      this.showEditModal.set(true)
    } else {
      this.selectedChange.set(null);
      this.showModal.set(true);
    }
  }
  /**
   * Closes the create/edit modal.
   */
  closeModal() {
    console.log("Closing modal")
    this.showModal.set(false);
  }

  /**
   * Handles the submission of the create change form.
   * @param change The partial change data from the form.
   */
  onCreateFormSubmit(change: Partial<Change>) {
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

  /**
   * Handles the submission of the edit change form.
   * @param change The partial change data from the form.
   */
  onEditFormSubmit(change: Partial<Change>) {
    console.log('Editing change:', change);
    const selected = this.selectedChange();
    const changeId = selected?.id || '';
    const updatedChange: Change = {
      ...(selected as Change),
      ...(change as Change),
      id: changeId,
      updatedAt: new Date(),
    };
    this.editChange.emit(updatedChange);
    this.showEditModal.set(false);
  }
}
