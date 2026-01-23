import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TaskTag } from '@optimistic-tanuki/ui-models';

/**
 * Tag selector component for selecting multiple tags
 */
@Component({
  selector: 'lib-tag-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './tag-selector.component.html',
  styleUrls: ['./tag-selector.component.scss'],
})
export class TagSelectorComponent implements OnInit {
  @Input() availableTags: TaskTag[] = [];
  @Input() selectedTagIds: string[] = [];
  @Output() selectionChange = new EventEmitter<string[]>();

  selectedTags: Set<string> = new Set();

  ngOnInit() {
    this.selectedTags = new Set(this.selectedTagIds || []);
  }

  toggleTag(tagId: string) {
    if (this.selectedTags.has(tagId)) {
      this.selectedTags.delete(tagId);
    } else {
      this.selectedTags.add(tagId);
    }
    this.selectionChange.emit(Array.from(this.selectedTags));
  }

  isSelected(tagId: string): boolean {
    return this.selectedTags.has(tagId);
  }

  getTagById(tagId: string): TaskTag | undefined {
    return this.availableTags.find((tag) => tag.id === tagId);
  }
}
