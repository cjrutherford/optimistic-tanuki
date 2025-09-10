import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-hero',
  imports: [CommonModule, ButtonComponent, HeadingComponent],
  templateUrl: './hero.component.html',
  styleUrls: ['./hero.component.scss'],
})
export class HeroComponent {}
