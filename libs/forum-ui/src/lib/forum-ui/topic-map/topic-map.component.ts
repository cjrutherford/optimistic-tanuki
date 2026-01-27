
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TopicCategory {
    id: string;
    name: string;
    count?: number;
    subtopics?: TopicCategory[];
}

@Component({
    selector: 'lib-forum-topic-map',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './topic-map.component.html',
    styleUrls: ['./topic-map.component.scss'],
})
export class TopicMapComponent {
    @Input() categories: TopicCategory[] = [];
    @Output() categoryClicked = new EventEmitter<TopicCategory>();

    onCategoryClick(category: TopicCategory) {
        this.categoryClicked.emit(category);
    }

    onSubtopicClick(subtopic: TopicCategory) {
        this.categoryClicked.emit(subtopic);
    }
}
