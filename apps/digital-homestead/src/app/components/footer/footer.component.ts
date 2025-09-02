import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeadingComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'dh-footer',
  imports: [CommonModule, HeadingComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {}
