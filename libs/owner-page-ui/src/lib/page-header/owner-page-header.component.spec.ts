import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OwnerPageHeaderComponent } from './owner-page-header.component';

@Component({
  standalone: true,
  imports: [OwnerPageHeaderComponent],
  template: `
    <ot-owner-page-header title="Users" [description]="description">
      @if (crumbs) {
      <nav ot-breadcrumb>Home / Users</nav>
      }
      <button ot-actions>Invite</button>
    </ot-owner-page-header>
  `,
})
class HostComponent {
  description: string | undefined = 'People with access.';
  crumbs = true;
}

describe('OwnerPageHeaderComponent', () => {
  function render(setup?: (host: HostComponent) => void) {
    const fixture = TestBed.createComponent(HostComponent);
    setup?.(fixture.componentInstance);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the title as the page h1 with description, breadcrumb and actions', () => {
    const el = render();
    expect(el.querySelector('h1')?.textContent).toContain('Users');
    expect(
      el.querySelector('.owner-page-header__description')?.textContent
    ).toContain('People with access.');
    expect(el.querySelector('[ot-breadcrumb]')?.textContent).toContain('Home');
    expect(
      el.querySelector('.owner-page-header__actions button')?.textContent
    ).toContain('Invite');
  });

  it('omits the description when none is given', () => {
    const el = render((h) => (h.description = undefined));
    expect(el.querySelector('.owner-page-header__description')).toBeNull();
  });

  it('leaves the breadcrumb slot empty so it can collapse', () => {
    const el = render((h) => (h.crumbs = false));
    expect(
      el.querySelector('.owner-page-header__crumbs')?.children.length
    ).toBe(0);
  });
});
