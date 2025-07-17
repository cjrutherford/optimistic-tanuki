import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonComponent, CardComponent, GridComponent, HeadingComponent, TileComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-project-grid',
  imports: [CommonModule, GridComponent, TileComponent, HeadingComponent, CardComponent, ButtonComponent],
  templateUrl: './project-grid.component.html',
  styleUrl: './project-grid.component.scss',
})
export class ProjectGridComponent {

  linkTo(url: string): void {
    window.open(url, '_blank');
  }
}
