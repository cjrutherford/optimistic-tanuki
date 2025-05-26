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
export class RadioButtonComponent {
  @Input() options: { label: string, value: number | string }[] = [];
  @Input() layout: 'vertical' | 'horizontal' | 'grid' = 'vertical';
  @Output() selectedValue = new EventEmitter<number|string>();
  @Input() selected!: number | string;

  onSelect(value: number | string) {
    this.selected = value;
    this.selectedValue.emit(this.selected);
  }
}
