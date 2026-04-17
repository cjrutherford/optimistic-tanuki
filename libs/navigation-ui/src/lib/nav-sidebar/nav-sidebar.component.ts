import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ButtonComponent,
  CardComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';

export interface NavItem {
  label: string;
  action?: () => void; // Optional action function
  variant?:
    | 'primary'
    | 'secondary'
    | 'outlined'
    | 'text'
    | 'warning'
    | 'danger'
    | 'success'
    | 'rounded';
  isActive?: boolean;
}

@Component({
  selector: 'otui-nav-sidebar',
  standalone: true,
  imports: [CommonModule, ButtonComponent, CardComponent, ModalComponent],
  templateUrl: './nav-sidebar.component.html',
  styleUrls: ['./nav-sidebar.component.scss'],
})
export class NavSidebarComponent {
  @Input() isOpen = false;
  @Input() navItems: NavItem[] = [];
  @Input() heading = 'Navigation';
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  navItemTrackBy(index: number, item: NavItem): number {
    return index; // Assuming label is unique for each nav item
  }

  onNavItemClick(item: NavItem) {
    // Handle action items
    if (item.action) {
      item.action();
      this.close.emit(); // Close sidebar after navigation
    }
  }

  getVariant(
    item: NavItem
  ):
    | 'primary'
    | 'secondary'
    | 'outlined'
    | 'text'
    | 'warning'
    | 'danger'
    | 'success'
    | 'rounded' {
    if (item.isActive) {
      return 'primary';
    }
    return item.variant || 'text';
  }
}
