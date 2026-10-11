import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ASSESSMENT_ROUTE, StackComponent } from '../../content/private-cloud';

/** Compact private-cloud stack entry; the full detail lives on the OSS page. */
@Component({
  selector: 'hai-stack-summary',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './stack-summary.component.html',
  styleUrl: './stack-summary.component.scss',
})
export class StackSummaryComponent {
  @Input({ required: true }) summary = '';
  @Input({ required: true }) services: StackComponent[] = [];
  @Input({ required: true }) platform: StackComponent[] = [];
  @Input({ required: true }) qualifier = '';

  readonly assessmentRoute = ASSESSMENT_ROUTE;

  get platformProjects(): string[] {
    return this.platform
      .map((component) => component.project)
      .filter((project) => !!project);
  }
}
