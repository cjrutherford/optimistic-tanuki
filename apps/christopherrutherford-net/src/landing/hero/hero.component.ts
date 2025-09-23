import { Component } from '@angular/core';

import { HeroComponent as HeroBlockComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'app-hero',
  imports: [HeroBlockComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {}
