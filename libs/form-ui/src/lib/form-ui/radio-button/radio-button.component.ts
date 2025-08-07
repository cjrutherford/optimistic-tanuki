import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'lib-radio-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio-button.component.html',
  styleUrls: ['./radio-button.component.scss'],
})
/**
 * A reusable radio button component.
 */
@Component({
  selector: 'lib-radio-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './radio-button.component.html',
  styleUrls: ['./radio-button.component.scss'],
})
export class RadioButtonComponent {
  /**
   * An array of options for the radio buttons. Each option has a label and a value.
   */
  @Input() options: { label: string, value: number | string }[] = [];
  /**
   * The layout of the radio buttons (vertical, horizontal, or grid).
   */
  @Input() layout: 'vertical' | 'horizontal' | 'grid' = 'vertical';
  /**
   * Emits the selected value when a radio button is chosen.
   */
  @Output() selectedValue = new EventEmitter<number|string>();
  /**
   * The currently selected value.
   */
  @Input() selected!: number | string;

  /**
   * Handles the selection of a radio button.
   * @param value The value of the selected radio button.
   */
  onSelect(value: number | string) {
    this.selected = value;
    this.selectedValue.emit(this.selected);
  }
}
