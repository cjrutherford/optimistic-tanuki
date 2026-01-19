import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

/**
 * Root AppComponent now delegates configuration loading to AppResolverComponent
 * This simplifies the architecture and enables multi-tenant support via routing
 */
@Component({
  imports: [CommonModule, RouterModule],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  protected title = 'configurable-client';
}
