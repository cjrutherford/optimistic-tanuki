import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HaiLogoComponent } from './hai-logo.component';

@Component({
  standalone: true,
  imports: [HaiLogoComponent],
  template: `<hai-logo id="a" /><hai-logo id="b" label="HAI" />`,
})
class HostComponent {}

describe('HaiLogoComponent', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an inline svg with the mark and wordmark', () => {
    const svg = render().querySelector('#a svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('10 10 296 254');
    expect(svg?.querySelectorAll('.hai-logo-bright').length).toBe(2);
    expect(svg?.querySelectorAll('.hai-logo-deep').length).toBe(3);
  });

  it('gives every instance its own clip ids', () => {
    const root = render();
    const ids = Array.from(root.querySelectorAll('clipPath')).map((c) => c.id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
    for (const el of Array.from(root.querySelectorAll('[clip-path]'))) {
      const ref = el.getAttribute('clip-path')?.slice(5, -1) ?? '';
      expect(ids).toContain(ref.replace('#', ''));
    }
  });

  it('is decorative by default', () => {
    const svg = render().querySelector('#a svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('focusable')).toBe('false');
    expect(svg?.hasAttribute('aria-label')).toBe(false);
  });

  it('uses the label when given', () => {
    const svg = render().querySelector('#b svg');
    expect(svg?.getAttribute('aria-label')).toBe('HAI');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
  });
});
