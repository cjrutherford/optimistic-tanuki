import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-breadcrumb',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.scss'],
})
/**
 * A reusable breadcrumb component.
 */
export class BreadcrumbComponent {
  /**
   * An array of strings representing the breadcrumb trail.
   */
  @Input() nodes: string[] = [];
  /**
   * Controls the visibility of a popup.
   */
  showPopup = false;

  /**
   * Toggles the visibility of the popup.
   */
  togglePopup() {
    this.showPopup = !this.showPopup;
  }
}
