
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TagDto } from '../models';

@Component({
    selector: 'lib-forum-tag-cloud',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './tag-cloud.component.html',
    styleUrls: ['./tag-cloud.component.scss'],
})
export class TagCloudComponent {
    @Input() tags: TagDto[] = [];
    @Output() tagClicked = new EventEmitter<TagDto>();

    onTagClick(tag: TagDto) {
        this.tagClicked.emit(tag);
    }
}
