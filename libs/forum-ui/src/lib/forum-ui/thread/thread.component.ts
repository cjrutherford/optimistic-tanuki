import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ThreadDto } from '../models';

@Component({
  selector: 'lib-forum-thread',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './thread.component.html',
  styleUrls: ['./thread.component.scss'],
})
export class ThreadComponent {
  @Input() thread!: ThreadDto;
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Output() threadClicked = new EventEmitter<ThreadDto>();
  @Output() editClicked = new EventEmitter<ThreadDto>();
  @Output() deleteClicked = new EventEmitter<ThreadDto>();

  onThreadClick() {
    this.threadClicked.emit(this.thread);
  }

  onEdit() {
    this.editClicked.emit(this.thread);
  }

  onDelete() {
    this.deleteClicked.emit(this.thread);
  }
}
