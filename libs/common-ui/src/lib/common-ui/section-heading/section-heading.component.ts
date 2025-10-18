import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'otui-section-heading',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './section-heading.component.html',
  styleUrls: ['./section-heading.component.scss'],
})
export class SectionHeadingComponent {
  @Input() heading = '';
  @Input() subheading?: string;
  @Input() background = 'rgba(33,33,33,0.15)';
  @Input() padding = '40px';
  @Input() borderRadius = '8px';
  @Input() color = '#fff';
}
