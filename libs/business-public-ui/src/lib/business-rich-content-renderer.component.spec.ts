import { Component, destroyPlatform } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import {
  renderApplication,
  provideServerRendering,
} from '@angular/platform-server';
import { BusinessRichContentRendererComponent } from './business-rich-content-renderer.component';

@Component({
  standalone: true,
  selector: 'app-root',
  imports: [BusinessRichContentRendererComponent],
  template: `<business-rich-content-renderer [content]="content" />`,
})
class ServerRichContentHostComponent {
  content = {
    title: 'Server story',
    content: '<p>Configured server-rendered body.</p>',
  };
}

describe('BusinessRichContentRendererComponent', () => {
  it('serializes configured rich content into raw SSR HTML', async () => {
    destroyPlatform();
    const html = await renderApplication(
      // Forwards the BootstrapContext renderApplication supplies. Angular 20.3
      // requires bootstrapApplication on the server to receive it and raises
      // NG0401 "Missing Platform" without it; 20.2 did not. This is the same
      // change the 20 apps' main.server.ts entries needed for the Angular bump.
      (context) =>
        bootstrapApplication(
          ServerRichContentHostComponent,
          { providers: [provideServerRendering()] },
          context
        ),
      {
        document: '<app-root></app-root>',
        url: '/sites/emberline-studio',
      }
    );

    expect(html).toContain('Configured server-rendered body.');
    destroyPlatform();
  });
});
