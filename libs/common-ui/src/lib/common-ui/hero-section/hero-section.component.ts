import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-hero-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero-section.component.html',
  styleUrls: ['./hero-section.component.scss'],
})
export class HeroSectionComponent {
  @Input() backgroundImage?: string;
  @Input() backgroundColor?: string;
  @Input() overlayOpacity = 0.4;
  @Input() overlayColor = '#000000';
  @Input() minHeight = '60vh';
  @Input() centerContent = true;
}
