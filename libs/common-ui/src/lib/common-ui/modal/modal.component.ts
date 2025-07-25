import { Component, EventEmitter, Input, Output } from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './modal.component.html',
  styleUrl: './modal.component.scss',
})
export class ModalComponent {
  @Input() heading = '';
  @Input() mode: 'sidebar' | 'trough' | 'standard-modal' | 'captive-modal' = 'standard-modal';
  @Output() closeModal = new EventEmitter<void>();

  onClose() {
    console.log('closing modal')
    this.closeModal.emit();
  }
}
