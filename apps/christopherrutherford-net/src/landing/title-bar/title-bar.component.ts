import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent, HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-title-bar',
  imports: [CommonModule, HeadingComponent, CardComponent],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent {}
