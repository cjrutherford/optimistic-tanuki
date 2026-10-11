import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Offering } from '../../content/site-content';

@Component({
  selector: 'hai-offerings-section',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './offerings-section.component.html',
  styleUrl: './offerings-section.component.scss',
})
export class OfferingsSectionComponent {
  @Input({ required: true }) offerings: Offering[] = [];
}
