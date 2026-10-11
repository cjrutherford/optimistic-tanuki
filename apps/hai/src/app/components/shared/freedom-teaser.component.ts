import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'hai-freedom-teaser',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './freedom-teaser.component.html',
  styleUrl: './freedom-teaser.component.scss',
})
export class FreedomTeaserComponent {
  @Input({ required: true }) principle = '';
  @Input({ required: true }) commitments: string[] = [];
  @Input() linkLabel = '';
  @Input() linkRoute = '';
}
