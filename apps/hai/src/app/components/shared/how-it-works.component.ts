import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProcessStep } from '../../content/private-cloud';

@Component({
  selector: 'hai-how-it-works',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './how-it-works.component.html',
  styleUrl: './how-it-works.component.scss',
})
export class HowItWorksComponent {
  @Input({ required: true }) steps: ProcessStep[] = [];
  @Input() moreRoute = '';
}
