import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, ButtonComponent } from '@optimistic-tanuki/common-ui';
import { TopicDto } from '../models';

@Component({
  selector: 'lib-forum-topic',
  standalone: true,
  imports: [CommonModule, CardComponent, ButtonComponent],
  templateUrl: './topic.component.html',
  styleUrls: ['./topic.component.scss'],
})
export class TopicComponent {
  @Input() topic!: TopicDto;
  @Input() canEdit = false;
  @Input() canDelete = false;
  @Output() topicClicked = new EventEmitter<TopicDto>();
  @Output() editClicked = new EventEmitter<TopicDto>();
  @Output() deleteClicked = new EventEmitter<TopicDto>();

  onTopicClick() {
    this.topicClicked.emit(this.topic);
  }

  onEdit() {
    this.editClicked.emit(this.topic);
  }

  onDelete() {
    this.deleteClicked.emit(this.topic);
  }
}
