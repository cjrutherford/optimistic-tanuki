import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'orch-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <div class="app-shell">
      <router-outlet />
    </div>
  `,
  styles: [
    `
      .app-shell {
        height: 100vh;
        display: flex;
        flex-direction: column;
        background: var(--bg-primary, #0d0d0d);
        color: var(--text-primary, #e0e0e0);
      }
    `,
  ],
})
export class AppComponent {}
