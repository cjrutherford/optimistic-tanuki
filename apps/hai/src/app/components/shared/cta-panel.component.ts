import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface CtaLink {
  label: string;
  route: string;
}

@Component({
  selector: 'hai-cta-panel',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cta-panel.component.html',
  styleUrl: './cta-panel.component.scss',
})
export class CtaPanelComponent {
  @Input() eyebrow = 'Next step';
  @Input({ required: true }) title = '';
  @Input() text = '';
  @Input({ required: true }) action!: CtaLink;
  @Input() secondaryPrompt = '';
  @Input() secondary?: CtaLink;
}
