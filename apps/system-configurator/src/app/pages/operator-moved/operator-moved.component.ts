import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Hardware quotes are an owner function and now live in the Owner Console
 * (Commerce → Hardware quotes). This page only says so.
 */
@Component({
  selector: 'app-operator-moved',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="moved">
      <h1>Hardware quotes have moved</h1>
      <p>
        Issuing and accepting hardware quotes is now done in the Owner Console,
        under Commerce, then Hardware quotes. Sign in there with your owner
        account.
      </p>
      <a routerLink="/">Back to the configurator</a>
    </main>
  `,
  styles: [
    `
      .moved {
        width: min(100% - 2rem, 640px);
        margin: 0 auto;
        padding: 3rem 0;
      }
    `,
  ],
})
export class OperatorMovedComponent {}
