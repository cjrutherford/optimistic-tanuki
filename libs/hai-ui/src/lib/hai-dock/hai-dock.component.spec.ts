import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { HaiAppDirectoryService } from '../hai-types/hai-app-directory.service';
import { HaiAboutConfig } from '../hai-types/hai-app.config';
import {
  HaiResolvedAppLink,
  resolveHaiAppLinks,
} from '../hai-types/hai-app.directory';
import { HaiDockComponent } from './hai-dock.component';
import { HaiDockItemComponent } from './hai-dock-item.component';
import { HaiDockShortcutStore } from './hai-dock-shortcut.store';

/** A store the test can inspect, shaped by a named interface. */
interface FakeStoreHandle {
  ids$: BehaviorSubject<string[]>;
  set: jest.Mock<void, [string[]]>;
}

class FakeShortcutStore
  extends HaiDockShortcutStore
  implements FakeStoreHandle
{
  ids$ = new BehaviorSubject<string[]>([]);
  set = jest.fn((ids: string[]) => this.ids$.next(ids));
  override get(): string[] {
    return this.ids$.value;
  }
  override observe(): Observable<string[]> {
    return this.ids$.asObservable();
  }
}

interface DirectoryDouble {
  getResolvedApps: jest.Mock<Observable<HaiResolvedAppLink[]>, [string?]>;
}

const CONFIG: HaiAboutConfig = {
  appId: 'hai',
  appName: 'HAI',
  appTagline: 'Custom software.',
  appDescription: 'HAI builds custom software.',
};

@Component({
  standalone: true,
  imports: [HaiDockComponent, HaiDockItemComponent],
  template: `
    <hai-dock [config]="config">
      <hai-dock-item label="Report a bug" (activated)="clicks = clicks + 1">
        <svg aria-hidden="true"></svg>
      </hai-dock-item>
    </hai-dock>
  `,
})
class HostComponent {
  config = CONFIG;
  clicks = 0;
}

describe('HaiDockComponent', () => {
  let store: FakeShortcutStore;
  let directory: DirectoryDouble;
  let fixture: ComponentFixture<HostComponent>;
  let root: HTMLElement;

  function apps(): HaiResolvedAppLink[] {
    // Every app is online except Forge of Will, which only has a repository
    // link, and Statocyst, which has no link at all.
    return resolveHaiAppLinks([], 'hai').map((app) =>
      ['forge-of-will', 'statocyst'].includes(app.appId)
        ? app
        : {
            ...app,
            runUrl: `https://${app.appId}.example.test`,
            resolvedHref: `https://${app.appId}.example.test`,
            isPublic: true,
          }
    );
  }

  async function setup(pinned: string[] = []) {
    store = new FakeShortcutStore();
    store.ids$.next(pinned);
    directory = { getResolvedApps: jest.fn().mockReturnValue(of(apps())) };
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        { provide: HaiDockShortcutStore, useValue: store },
        { provide: HaiAppDirectoryService, useValue: directory },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    root = fixture.nativeElement as HTMLElement;
    document.body.appendChild(root);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  afterEach(() => root?.remove());

  const q = (selector: string) => root.querySelector<HTMLElement>(selector);
  const all = (selector: string) =>
    Array.from(root.querySelectorAll<HTMLElement>(selector));
  const controls = () => all('.hai-dock__bar .hai-dock-item__control');
  const press = (target: Element, key: string) =>
    target.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
  async function openPicker() {
    (q('[data-testid="hai-dock-add"] button') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('is a labelled toolbar holding About, projected items and Add shortcut', async () => {
    await setup();
    const bar = q('[data-testid="hai-dock"]') as HTMLElement;

    expect(bar.getAttribute('role')).toBe('toolbar');
    expect(bar.getAttribute('aria-label')).toBe('App dock');
    expect(
      controls().map((control) => control.getAttribute('aria-label'))
    ).toEqual(['About HAI', 'Report a bug', 'Add shortcut']);
  });

  it('shows the theme-aware logo in the About item', async () => {
    await setup();

    expect(q('[data-testid="hai-dock-about"] hai-logo svg')).not.toBeNull();
  });

  it('opens the About modal from the About item', async () => {
    await setup();
    expect(root.textContent).not.toContain('Made with Love in Savannah');

    (q('[data-testid="hai-dock-about"] button') as HTMLElement).click();
    fixture.detectChanges();

    expect(q('[data-testid="hai-about-modal"]')).not.toBeNull();
    expect(root.textContent).toContain('Made with Love in Savannah');
  });

  it('forwards a projected item click without any dock change', async () => {
    await setup();

    (controls()[1] as HTMLElement).click();

    expect(fixture.componentInstance.clicks).toBe(1);
  });

  it('keeps one tab stop and moves it with the arrow keys, Home and End', async () => {
    await setup();
    const [about, bug, add] = controls();
    expect(controls().map((c) => c.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
    ]);

    about.focus();
    press(about, 'ArrowRight');
    expect(document.activeElement).toBe(bug);
    expect(controls().map((c) => c.getAttribute('tabindex'))).toEqual([
      '-1',
      '0',
      '-1',
    ]);

    press(bug, 'End');
    expect(document.activeElement).toBe(add);
    press(add, 'ArrowRight');
    expect(document.activeElement).toBe(add);
    press(add, 'ArrowLeft');
    expect(document.activeElement).toBe(bug);
    press(bug, 'Home');
    expect(document.activeElement).toBe(about);
  });

  it('lists only online apps to pin, leaving out the current app and repository-only apps', async () => {
    await setup();
    await openPicker();
    const names = all('.hai-dock__picker-name').map((n) => n.textContent);

    expect(q('[data-testid="hai-dock-picker"]')?.getAttribute('role')).toBe(
      'dialog'
    );
    expect(names).toContain('Fin Commander');
    expect(names).not.toContain('HAI');
    expect(names).not.toContain('Statocyst');
    expect(names).not.toContain('Forge of Will');
    expect(all('.hai-dock__picker-meta').map((n) => n.textContent)).toContain(
      'fin-commander.example.test'
    );
    expect(directory.getResolvedApps).toHaveBeenCalledWith('hai');
  });

  it('leaves the current app out even if the directory returns it', async () => {
    await setup();
    directory.getResolvedApps.mockReturnValue(
      of(
        apps().map((app) =>
          app.appId === 'fin-commander' ? { ...app, configName: 'hai' } : app
        )
      )
    );
    await openPicker();

    expect(
      all('.hai-dock__picker-name').map((n) => n.textContent)
    ).not.toContain('Fin Commander');
  });

  it('pins an app through the store and shows it as a shortcut link', async () => {
    await setup();
    await openPicker();

    (
      q('button[aria-label="Add Fin Commander to the dock"]') as HTMLElement
    ).click();
    fixture.detectChanges();

    expect(store.set).toHaveBeenCalledWith(['fin-commander']);
    const shortcut = q('[data-testid="hai-dock-shortcut"] a') as HTMLElement;
    expect(shortcut.getAttribute('aria-label')).toBe(
      'Fin Commander (opens in a new tab)'
    );
    expect(shortcut.getAttribute('href')).toBe(
      'https://fin-commander.example.test'
    );
    expect(shortcut.getAttribute('rel')).toBe('noopener noreferrer');
    expect(q('[role="status"]')?.textContent).toContain('Fin Commander');
  });

  it('unpins from the picker through the store', async () => {
    await setup(['fin-commander']);
    await openPicker();

    (
      q(
        'button[aria-label="Remove Fin Commander from the dock"]'
      ) as HTMLElement
    ).click();
    fixture.detectChanges();

    expect(store.set).toHaveBeenCalledWith([]);
    expect(q('[data-testid="hai-dock-shortcut"]')).toBeNull();
  });

  it('removes a pinned shortcut with Delete and moves focus to Add shortcut', async () => {
    await setup(['fin-commander', 'towne-square']);
    const shortcut = q('[data-testid="hai-dock-shortcut"] a') as HTMLElement;
    shortcut.focus();

    press(shortcut, 'Delete');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(store.set).toHaveBeenCalledWith(['towne-square']);
    expect(all('[data-testid="hai-dock-shortcut"]')).toHaveLength(1);
    expect(document.activeElement).toBe(
      q('[data-testid="hai-dock-add"] button')
    );
  });

  it('removes a pinned shortcut with Backspace too', async () => {
    await setup(['fin-commander', 'towne-square']);
    const shortcut = q('[data-testid="hai-dock-shortcut"] a') as HTMLElement;
    shortcut.focus();

    press(shortcut, 'Backspace');
    fixture.detectChanges();

    expect(store.set).toHaveBeenCalledWith(['towne-square']);
  });

  it('does not draw a stored pin for an app that is no longer online', async () => {
    await setup(['forge-of-will', 'fin-commander']);

    expect(
      all('[data-testid="hai-dock-shortcut"] a').map((a) =>
        a.getAttribute('aria-label')
      )
    ).toEqual(['Fin Commander (opens in a new tab)']);
  });

  it('draws stored pins in order and ignores ids that match no app', async () => {
    await setup(['towne-square', 'no-such-app', 'fin-commander']);

    expect(
      all('[data-testid="hai-dock-shortcut"] a').map((a) =>
        a.getAttribute('aria-label')
      )
    ).toEqual([
      'Towne Square (opens in a new tab)',
      'Fin Commander (opens in a new tab)',
    ]);
  });

  it('closes the picker with Escape and returns focus to Add shortcut', async () => {
    await setup();
    await openPicker();
    expect(q('[data-testid="hai-dock-picker"]')).not.toBeNull();

    press(q('[data-testid="hai-dock-picker"]') as HTMLElement, 'Escape');
    fixture.detectChanges();

    expect(q('[data-testid="hai-dock-picker"]')).toBeNull();
    expect(document.activeElement).toBe(
      q('[data-testid="hai-dock-add"] button')
    );
  });

  it('moves focus into the picker when it opens', async () => {
    await setup();
    await openPicker();

    expect(
      q('[data-testid="hai-dock-picker"]')?.contains(document.activeElement)
    ).toBe(true);
  });

  it('closes the picker on a press outside the dock', async () => {
    await setup();
    await openPicker();

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    fixture.detectChanges();

    expect(q('[data-testid="hai-dock-picker"]')).toBeNull();
  });
});
