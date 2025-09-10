import { Component, Input } from '@angular/core';
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
  @Input() excerpt = '';
  @Input() authorName = '';
  @Input() publishDate = '';
  @Input() readMoreLink = '#';

  onReadMoreClick() {
    window.open(this.readMoreLink, '_blank');
  }
}
