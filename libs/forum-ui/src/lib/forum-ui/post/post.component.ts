import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { ForumPostDto } from '../models';

@Component({
  selector: 'lib-forum-post',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './post.component.html',
  styleUrls: ['./post.component.scss'],
})
export class ForumPostComponent {
  @Input() post!: ForumPostDto;
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Output() editClicked = new EventEmitter<ForumPostDto>();
  @Output() deleteClicked = new EventEmitter<ForumPostDto>();

  onEdit() {
    this.editClicked.emit(this.post);
  }

  onDelete() {
    this.deleteClicked.emit(this.post);
  }
}
