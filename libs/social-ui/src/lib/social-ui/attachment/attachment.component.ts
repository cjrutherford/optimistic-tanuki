import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, GridComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-attachment',
  standalone: true,
  imports: [CommonModule, CardComponent, GridComponent, ButtonComponent],
  templateUrl: './attachment.component.html',
  styleUrls: ['./attachment.component.scss'],
})
/**
 * Component for managing attachments.
 */
@Component({
  selector: 'lib-attachment',
  standalone: true,
  imports: [CommonModule, CardComponent, GridComponent, ButtonComponent],
  templateUrl: './attachment.component.html',
  styleUrls: ['./attachment.component.scss'],
})
export class AttachmentComponent {
  /**
   * Input property for the list of attachments.
   */
  @Input() attachments: File[] = [];
  /**
   * Emits changes to the attachments list (added, removed, all).
   */
  @Output() attachmentsChange = new EventEmitter<{ 
    all: File[], 
    added: File[], 
    removed: File[] 
  }>();

  private addedAttachments: File[] = [];
  private removedAttachments: File[] = [];

  /**
   * Adds a new attachment to the list.
   * @param file The file to add as an attachment.
   */
  addAttachment(file: File) {
    this.attachments.push(file);
    this.addedAttachments.push(file);
    this.emitChanges();
  }

  /**
   * Removes an attachment from the list.
   * @param attachment The attachment to remove.
   */
  removeAttachment(attachment: File) {
    const index = this.attachments.findIndex(att => att.name === attachment.name && att.type === attachment.type);
    if (index > -1) {
      this.attachments.splice(index, 1);
      this.removedAttachments.push(attachment);
      this.emitChanges();
    }
  }

  /**
   * Emits the attachmentsChange event with the current state of attachments.
   */
  private emitChanges() {
    this.attachmentsChange.emit({
      all: this.attachments,
      added: this.addedAttachments,
      removed: this.removedAttachments
    });
  }
}
