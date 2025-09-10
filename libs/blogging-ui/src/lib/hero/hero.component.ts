import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, GlassContainerComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-hero',
  imports: [CommonModule, GlassContainerComponent, HeadingComponent, ButtonComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
  host: {
    '[style.--background-image]': 'imageUrl ? "url(" + imageUrl + ")" : "none"',
  }
})
export class HeroComponent {
  @Input() title = 'Welcome to Our Blog!';
  @Input() subtitle = '';
  @Input() description = 'Discover the latest news, tips, and stories from our community.';
  @Input() buttonText = 'Get Started';
  @Input() imageUrl = 'https://via.placeholder.com/600x400';
}
