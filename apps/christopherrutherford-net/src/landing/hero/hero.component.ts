import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroComponent as HeroBlockComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'app-hero',
  imports: [CommonModule, HeroBlockComponent],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
})
export class HeroComponent {}
