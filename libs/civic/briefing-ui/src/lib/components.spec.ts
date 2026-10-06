import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BriefingBodyComponent } from './briefing-body.component';
import { EditionStripComponent } from './edition-strip.component';

@Component({
  imports: [BriefingBodyComponent, EditionStripComponent],
  template: `
    <civic-briefing-body [markdown]="markdown()" />
    <civic-edition-strip
      [route]="['/city', 'tifton-ga', 'briefing']"
      [published]="['2026-09-15', '2026-09-17']"
      end="2026-09-17"
      current="2026-09-17"
    />
  `,
})
class HostComponent {
  readonly markdown = signal('');
}

describe('briefing components', () => {
  function render(markdown: string): HTMLElement {
    TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.markdown.set(markdown);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the briefing through Angular, links and coverage notes intact', () => {
    const page = render(
      '# Title\n\nLead.\n\n- [source](https://example.com/a)\n\n<details>\n<summary>Sources</summary>\n\n- one\n\n</details>'
    );
    const text = page.querySelector('.briefing-text');
    expect(text?.querySelector('h1')).toBeNull();
    const link = text?.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(text?.querySelector('details summary')?.textContent).toBe('Sources');
  });

  it('links each published day under the given route, and marks gaps', () => {
    const page = render('');
    const links = Array.from(page.querySelectorAll('civic-edition-strip a'));
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/city/tifton-ga/briefing/2026-09-15',
      '/city/tifton-ga/briefing/2026-09-17',
    ]);
    expect(links[1]?.getAttribute('aria-current')).toBe('page');
    expect(page.querySelectorAll('civic-edition-strip .missing').length).toBe(
      26
    );
  });
});
