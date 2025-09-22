import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-blog-post-card',
  imports: [CommonModule, CardComponent, HeadingComponent, ButtonComponent],
  templateUrl: './card.component.html',
  styleUrl: './card.component.scss',
})
export class BlogPostCardComponent {
  @Input() title = 'A Blog Post Title';
  @Input() bannerImage = 'https://picsum.photos/600/200';
  @Input() excerpt =
    'This is a short excerpt from the blog post to give readers an idea of the content.';
  @Input() authorName = 'Author Name';
  @Input() publishDate = 'January 1, 2024';
  @Input() readMoreText = 'Read More';
  @Input() readMoreLink = '#';
  @Input() secondaryButtonText = '';
  @Output() secondaryButtonAction: EventEmitter<void> = new EventEmitter<void>();

  onReadMoreClick() {
    window.open(this.readMoreLink, '_blank');
  }

  onSecondaryButtonClick() {
    this.secondaryButtonAction.emit();
  }
}
