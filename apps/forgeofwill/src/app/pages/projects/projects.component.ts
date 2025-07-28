import { ProjectOverviewComponent, ProjectSelectorComponent } from '@optimistic-tanuki/project-ui';

import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, ProjectOverviewComponent, ProjectSelectorComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent {}
