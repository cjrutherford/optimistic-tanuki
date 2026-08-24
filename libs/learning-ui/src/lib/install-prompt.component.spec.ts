import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { InstallPromptComponent } from './install-prompt.component';

describe('InstallPromptComponent', () => {
  async function render() {
    TestBed.configureTestingModule({ imports: [InstallPromptComponent] });
    const fixture = TestBed.createComponent(InstallPromptComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      fixture,
      element: fixture.nativeElement as HTMLElement,
      button: (label: string) =>
        Array.from(
          (fixture.nativeElement as HTMLElement).querySelectorAll('button')
        ).find((candidate) => candidate.textContent?.trim() === label),
    };
  }

  it('says what installing actually gets you', async () => {
    const { element } = await render();

    expect(element.textContent).toContain('without a connection');
  });

  it('offers to install', async () => {
    const { fixture, button } = await render();
    const asked = jest.fn();
    fixture.componentInstance.install.subscribe(asked);

    button('Install')?.click();

    expect(asked).toHaveBeenCalledTimes(1);
  });

  // A prompt that cannot be refused is the reason people hate prompts.
  it('offers a way to refuse', async () => {
    const { fixture, button } = await render();
    const refused = jest.fn();
    fixture.componentInstance.dismiss.subscribe(refused);

    button('Not now')?.click();

    expect(refused).toHaveBeenCalledTimes(1);
  });

  // jsdom resolves no cascade, so the 44px target is asserted on the source
  // rather than on a computed style that would report a default either way.
  it('gives both actions a full-sized touch target', () => {
    const source = readFileSync(
      join(__dirname, 'install-prompt.component.ts'),
      'utf8'
    );

    expect(source).toContain('min-height: 44px');
  });

  it('names itself for a screen reader', async () => {
    const { element } = await render();

    expect(element.querySelector('aside')?.getAttribute('aria-label')).toBe(
      'Install this app'
    );
  });
});
