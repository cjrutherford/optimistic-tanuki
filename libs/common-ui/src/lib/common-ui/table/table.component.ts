import { Component, Input, TemplateRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component'; // Add this import

export interface TableRowAction {
  title: string;
  action: (index: number) => void | Promise<void>;
}

export interface TableCell {
  heading?: string;
  value?: string | TemplateRef<HTMLElement>;
  isBadge?: boolean;
  customStyles?: { [key: string]: string };
  isSpacer?: boolean;
}

@Component({
  selector: 'otui-table',
  standalone: true,
  imports: [CommonModule, ButtonComponent], // Add ButtonComponent to imports
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
})
export class TableComponent implements OnInit {
  @Input() cells: TableCell[] = [];
  @Input() rowIndex = 0;
  @Input() rowActions?: TableRowAction[];
  @Input() tableStyles: { [key: string]: string } = {};
  @Input() spacer?: boolean = false;

  cellTemplates: (TemplateRef<HTMLElement> | null)[] = []; 
  showActions = false;

  ngOnInit() {
    this.cellTemplates = this.cells.map(cell => {
      if (cell.isBadge) {
        cell.heading = undefined;
      }
      if (cell.value instanceof TemplateRef) {
        return cell.value;
      } else {
        return null;
      }
    });

    if (this.spacer) {
      this.cells.push({ value: '', customStyles: { flex: '1' } });
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  isTemplateRef(value: any): value is TemplateRef<HTMLElement> {
    return value instanceof TemplateRef;
  }

  toggleActions() {
    this.showActions = !this.showActions;
  }

  executeAction(action: TableRowAction) {
    action.action(this.rowIndex);
    this.showActions = false;
  }
}
