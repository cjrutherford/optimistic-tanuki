import { Component } from '@angular/core';

import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { HeroComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-hero-section',
  imports: [ButtonComponent, HeadingComponent, HeroComponent],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss'],
})
export class HeroSectionComponent {}
