import { Component, Input, TemplateRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent } from '../button/button.component';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';

export interface TableRowAction {
  title: string;
  action: (index: number) => void | Promise<void>;
}

export interface TableCell {
  heading?: string;
  value?: string | TemplateRef<HTMLElement>;
  isBadge?: boolean;
  isOverflowable?: boolean;
  customStyles?: { [key: string]: string };
  isSpacer?: boolean;
}

@Component({
  selector: 'otui-table',
  standalone: true,
  imports: [CommonModule, ButtonComponent],
  templateUrl: './table.component.html',
  styleUrls: ['./table.component.scss'],
  host: {
    'class.theme': 'theme',
    '[style.--background]': 'background',
    '[style.--background-gradient]': 'backgroundGradient',
    '[style.--foreground]': 'foreground',
    '[style.--accent]': 'accent',
    '[style.--complement]': 'complement',
    '[style.--border-color]': 'borderColor',
    '[style.--border-gradient]': 'borderGradient',
    '[style.--transition-duration]': 'transitionDuration',
  }
})
export class TableComponent extends Themeable implements OnInit {
  @Input() cells: TableCell[] = [];
  @Input() rowIndex = 0;
  @Input() rowActions?: TableRowAction[];
  @Input() tableStyles: { [key: string]: string } = {};
  @Input() spacer?: boolean = false;
  @Input() showActionsSplit = false;

  backgroundGradient = 'linear-gradient(to right, #5969c3, #59c360)';

  cellTemplates: (TemplateRef<HTMLElement> | null)[] = []; 
  showActions = false;
  rowExpanded = false;

  override applyTheme(colors: ThemeColors): void {
    // Use a softer gradient: background -> accent (60%) -> accent lighten (100%)
    const accentLight = colors.accentShades?.[1][1] ?? colors.accent;
    this.background = colors.background;
    this.backgroundGradient = `linear-gradient(to bottom, ${colors.accent}, ${colors.background}, ${colors.background}, ${accentLight})`;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    if(this.theme === 'dark') {
      this.borderGradient = colors.accentGradients['dark'];
      this.borderColor = colors.complementaryShades[2][1];
    } else {
      this.borderGradient = colors.accentGradients['light'];
      this.borderColor = colors.complementaryShades[2][1];
    }
    this.transitionDuration = '0.3s';
    this.initializeTable();
  }

  private initializeTable() {
    this.cellTemplates = [];
    this.cells.forEach(cell => {
      if (cell.isBadge) {
        cell.heading = undefined;
      }
      if (cell.value instanceof TemplateRef) {
        this.cellTemplates.push(cell.value);
      } else {
        this.cellTemplates.push(null);
      }
    });

    if (this.spacer) {
      this.cells.push({ value: '', customStyles: { flex: '1' } });
    }
  }

  get hasOverflowableCells(): boolean {
    return this.cells.some(cell => cell.isOverflowable);
  }

  toggleRowExpansion() {
    this.rowExpanded = !this.rowExpanded;
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
