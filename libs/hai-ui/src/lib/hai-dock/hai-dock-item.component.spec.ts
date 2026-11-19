import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HaiDockItemComponent } from './hai-dock-item.component';

@Component({
  standalone: true,
  imports: [HaiDockItemComponent],
  template: `
    <hai-dock-item label="Chat" [active]="true" (activated)="log.push('chat')"
      ><svg aria-hidden="true"></svg
    ></hai-dock-item>
    <hai-dock-item label="Docs" href="/docs"></hai-dock-item>
    <hai-dock-item label="Store" href="https://x.test" [external]="true">
    </hai-dock-item>
  `,
})
class HostComponent {
  log: string[] = [];
}

describe('HaiDockItemComponent', () => {
  function render() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a labelled button that emits when activated', () => {
    const fixture = render();
    const button = fixture.nativeElement.querySelector(
      'button'
    ) as HTMLButtonElement;

    button.click();

    expect(button.getAttribute('aria-label')).toBe('Chat');
    expect(button.getAttribute('aria-current')).toBe('true');
    expect(button.querySelector('svg')).not.toBeNull();
    expect(fixture.componentInstance.log).toEqual(['chat']);
  });

  it('renders a link when given an href, and flags new-tab links in the name', () => {
    const links = Array.from(
      render().nativeElement.querySelectorAll('a')
    ) as HTMLAnchorElement[];

    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/docs',
      'https://x.test',
    ]);
    expect(links.map((a) => a.getAttribute('aria-label'))).toEqual([
      'Docs',
      'Store (opens in a new tab)',
    ]);
    expect(links[1].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('target')).toBeNull();
  });

  it('keeps the visible hover label out of the accessibility tree', () => {
    const label = render().nativeElement.querySelector(
      '.hai-dock-item__label'
    ) as HTMLElement;

    expect(label.textContent).toBe('Chat');
    expect(label.getAttribute('aria-hidden')).toBe('true');
  });
});
