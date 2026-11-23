import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OwnerNavEntry, navigableEntries } from '../owner-nav';
import { CommandPaletteComponent } from './command-palette.component';

@Component({
  standalone: true,
  imports: [CommandPaletteComponent],
  template: `<app-command-palette
    [open]="open()"
    [entries]="entries"
    (closed)="closes = closes + 1"
    (chosen)="picked = $event"
  />`,
})
class HostComponent {
  open = signal(true);
  entries = navigableEntries();
  closes = 0;
  picked?: OwnerNavEntry;
}

describe('CommandPaletteComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const input = (): HTMLInputElement =>
      fixture.debugElement.query(By.css('input')).nativeElement;
    const options = (): string[] =>
      fixture.debugElement
        .queryAll(By.css('[role="option"]'))
        .map((el) => el.nativeElement.textContent.replace(/\s+/g, ' ').trim());
    const type = (value: string): void => {
      input().value = value;
      input().dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const key = (name: string): void => {
      fixture.debugElement
        .query(By.css('[role="dialog"]'))
        .nativeElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: name, bubbles: true })
        );
      fixture.detectChanges();
    };
    return {
      fixture,
      host: fixture.componentInstance,
      input,
      options,
      type,
      key,
    };
  };

  it('is an accessible dialog with a combobox and listbox', () => {
    const { fixture, input } = setup();
    const dialog = fixture.debugElement.query(By.css('[role="dialog"]'));
    expect(dialog.attributes['aria-modal']).toBe('true');
    expect(input().getAttribute('role')).toBe('combobox');
    expect(
      fixture.debugElement.query(By.css('[role="listbox"]'))
    ).not.toBeNull();
    expect(input().getAttribute('aria-activedescendant')).toBe(
      'palette-option-0'
    );
  });

  it('renders nothing while closed', () => {
    const { fixture, host } = setup();
    host.open.set(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[role="dialog"]'))).toBeNull();
  });

  it('filters by label, group and keyword', () => {
    const { options, type } = setup();
    type('orders');
    expect(options()[0]).toContain('Orders');
    type('moderation');
    expect(options().join('|')).toContain('Forum moderation');
    type('zzzqqq');
    expect(options()).toEqual([]);
  });

  it('moves the active option with the arrow keys and wraps', () => {
    const { fixture, input, key } = setup();
    key('ArrowDown');
    expect(input().getAttribute('aria-activedescendant')).toBe(
      'palette-option-1'
    );
    expect(
      fixture.debugElement.query(By.css('#palette-option-1')).attributes[
        'aria-selected'
      ]
    ).toBe('true');
    key('ArrowUp');
    key('ArrowUp');
    const last = navigableEntries().length - 1;
    expect(input().getAttribute('aria-activedescendant')).toBe(
      `palette-option-${last}`
    );
  });

  it('chooses the active option with Enter and closes', () => {
    const { host, type, key } = setup();
    type('security');
    key('Enter');
    expect(host.picked?.leaf.label).toBe('Security');
    expect(host.closes).toBe(1);
  });

  it('closes on Escape', () => {
    const { host, key } = setup();
    key('Escape');
    expect(host.closes).toBe(1);
  });

  it('closes when the scrim is clicked', () => {
    const { fixture, host } = setup();
    fixture.debugElement.query(By.css('.scrim')).nativeElement.click();
    expect(host.closes).toBe(1);
  });
});
