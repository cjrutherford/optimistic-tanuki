import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';
import { HeroComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  selector: 'dh-hero-section',
  imports: [CommonModule, ButtonComponent, HeadingComponent, HeroComponent],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss'],
})
export class HeroSectionComponent {}
