import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudiencePath } from '../../content/private-cloud';

@Component({
  selector: 'hai-audience-selector',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './audience-selector.component.html',
  styleUrl: './audience-selector.component.scss',
})
export class AudienceSelectorComponent {
  @Input() sectionId = 'audiences';
  @Input() eyebrow = "Who it's for";
  @Input() heading = 'Choose your path.';
  @Input({ required: true }) paths: AudiencePath[] = [];
  /** Columns on wide screens; cards stack below 760px, or 960px past two. */
  @Input() columns = 2;
  @Input() note = '';
}
