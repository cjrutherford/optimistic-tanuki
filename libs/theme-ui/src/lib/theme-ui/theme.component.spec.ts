import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { Type } from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ThemeToggleComponent } from './theme.component';
import { PersonalityPickerHostComponent } from './personality-picker-host.component';
import {
  THEME_PERSONALITY_PICKER_LOADER,
  type PersonalityPickerHostContract,
  type PersonalityPickerLoader,
} from './personality-picker-loader';

describe('ToggleComponent', () => {
  let component: ThemeToggleComponent;
  let fixture: ComponentFixture<ThemeToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function appearanceMenu(): HTMLElement | null {
    return document.querySelector(
      '.appearance-menu-overlay-host .toggle-container'
    );
  }

  function personalityTrigger(): HTMLButtonElement | null {
    return document.querySelector(
      '.appearance-menu-overlay-host .personality-trigger'
    );
  }

  describe('ThemeToggleComponent personality picker loading', () => {
    async function createFixture(loader: PersonalityPickerLoader) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ThemeToggleComponent],
        providers: [
          {
            provide: THEME_PERSONALITY_PICKER_LOADER,
            useValue: loader,
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(ThemeToggleComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('keeps the picker out of the initial view and shows loading until it resolves', async () => {
      let resolvePicker!: (picker: Type<PersonalityPickerHostContract>) => void;
      const loader: PersonalityPickerLoader = () =>
        new Promise((resolve) => {
          resolvePicker = resolve;
        });
      const fixture = await createFixture(loader);
      const component = fixture.componentInstance;

      expect(document.querySelector('lib-personality-picker-host')).toBe(null);

      component.openPersonalityPicker();
      fixture.detectChanges();

      expect(component.personalityPickerLoading).toBe(true);
      expect(document.body.textContent).toContain('Loading styles');

      resolvePicker(PersonalityPickerHostComponent);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.personalityPickerLoading).toBe(false);
      expect(
        document.querySelector('lib-personality-picker-host')
      ).toBeTruthy();
    });

    it('shows an error and retries a failed picker load', async () => {
      let attempts = 0;
      const loader: PersonalityPickerLoader = () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('picker unavailable'))
          : Promise.resolve(PersonalityPickerHostComponent);
      };
      const fixture = await createFixture(loader);
      const component = fixture.componentInstance;

      component.openPersonalityPicker();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.personalityPickerError).toBe(true);
      expect(document.body.textContent).toContain('Styles could not be loaded');

      (
        document.querySelector(
          '.personality-picker-dialog [role="alert"] button'
        ) as HTMLButtonElement
      ).click();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(attempts).toBe(2);
      expect(component.personalityPickerError).toBe(false);
      expect(
        document.querySelector('lib-personality-picker-host')
      ).toBeTruthy();
    });

    it('keeps loading and error states inside a dismissible modal dialog', async () => {
      let rejectPicker!: (reason?: unknown) => void;
      const loader: PersonalityPickerLoader = () =>
        new Promise((_, reject) => {
          rejectPicker = reject;
        });
      const fixture = await createFixture(loader);
      const component = fixture.componentInstance;

      component.openPersonalityPicker();
      fixture.detectChanges();

      const loadingDialog = document.querySelector(
        '.personality-picker-dialog'
      ) as HTMLElement;
      await fixture.whenStable();
      expect(document.activeElement).toBe(
        loadingDialog.querySelector('.personality-picker-status-close')
      );
      expect(loadingDialog.getAttribute('role')).toBe('dialog');
      expect(loadingDialog.getAttribute('aria-modal')).toBe('true');
      expect(
        document.getElementById(
          loadingDialog.getAttribute('aria-labelledby') ?? ''
        )
      ).toBeTruthy();
      expect(loadingDialog.querySelector('button')?.textContent).toContain(
        'Close'
      );

      rejectPicker(new Error('picker unavailable'));
      await fixture.whenStable();
      fixture.detectChanges();

      expect(
        document.querySelector('.personality-picker-dialog [role="alert"]')
      ).toBeTruthy();
      expect(
        document.querySelector('.personality-picker-dialog button')
      ).toBeTruthy();
      expect(
        document.getElementById(
          loadingDialog.getAttribute('aria-labelledby') ?? ''
        )
      ).toBeTruthy();
    });

    it('ignores an out-of-order lazy picker resolution after close and reopen', async () => {
      const resolvers: Array<
        (picker: Type<PersonalityPickerHostContract>) => void
      > = [];
      const loader: PersonalityPickerLoader = () =>
        new Promise((resolve) => resolvers.push(resolve));
      const fixture = await createFixture(loader);
      const component = fixture.componentInstance;

      component.openPersonalityPicker();
      fixture.detectChanges();
      component.closePersonalityPicker();
      fixture.detectChanges();
      component.openPersonalityPicker();
      fixture.detectChanges();

      expect(resolvers).toHaveLength(2);

      resolvers[1](PersonalityPickerHostComponent);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.personalityPickerLoading).toBe(false);
      expect(
        document.querySelectorAll('lib-personality-picker-host')
      ).toHaveLength(1);

      resolvers[0](PersonalityPickerHostComponent);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.personalityPickerError).toBe(false);
      expect(
        document.querySelectorAll('lib-personality-picker-host')
      ).toHaveLength(1);
    });

    it('keeps picker retry and selection clicks internal to the appearance menu', async () => {
      let attempts = 0;
      const loader: PersonalityPickerLoader = () => {
        attempts += 1;
        return attempts === 1
          ? Promise.reject(new Error('picker unavailable'))
          : Promise.resolve(PersonalityPickerHostComponent);
      };
      const fixture = await createFixture(loader);
      const component = fixture.componentInstance;

      component.toggleControls();
      fixture.detectChanges();
      component.openPersonalityPicker();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(component.showControls).toBe(true);
      expect(component.personalityPickerError).toBe(true);

      (
        document.querySelector(
          '.personality-picker-dialog [role="alert"] button'
        ) as HTMLButtonElement
      ).click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.showControls).toBe(true);
      expect(component.showPersonalityPicker).toBe(true);

      (
        document.querySelector(
          '.personality-picker-dialog .personality-option'
        ) as HTMLButtonElement | null
      )?.click();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(component.showControls).toBe(true);
      expect(component.showPersonalityPicker).toBe(false);
      expect(
        document.querySelector('.appearance-menu-overlay-host')
      ).toBeTruthy();
    });

    it('closes both portals on navigation without restoring focus to a removed trigger', async () => {
      const navigationEvents = new Subject<NavigationStart>();
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ThemeToggleComponent],
        providers: [
          {
            provide: THEME_PERSONALITY_PICKER_LOADER,
            useValue: () => Promise.resolve(PersonalityPickerHostComponent),
          },
          {
            provide: Router,
            useValue: { events: navigationEvents.asObservable() },
          },
        ],
      }).compileComponents();

      const fixture = TestBed.createComponent(ThemeToggleComponent);
      const component = fixture.componentInstance;
      const backgroundButton = document.createElement('button');
      backgroundButton.setAttribute('inert', 'previous');
      backgroundButton.setAttribute('aria-hidden', 'false');
      document.body.appendChild(backgroundButton);

      try {
        fixture.detectChanges();
        component.toggleControls();
        fixture.detectChanges();
        component.openPersonalityPicker();
        await fixture.whenStable();
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.showControls).toBe(true);
        expect(component.showPersonalityPicker).toBe(true);
        expect(
          document.querySelector('.appearance-menu-overlay-host')
        ).toBeTruthy();
        expect(
          document.querySelector('.personality-picker-overlay-host')
        ).toBeTruthy();
        expect(backgroundButton.getAttribute('inert')).toBe('');
        expect(backgroundButton.getAttribute('aria-hidden')).toBe('true');

        const focusSpy = jest
          .spyOn(HTMLElement.prototype, 'focus')
          .mockImplementation(() => undefined);
        focusSpy.mockClear();
        fixture.nativeElement.remove();

        navigationEvents.next(new NavigationStart(1, '/courses'));
        fixture.detectChanges();

        expect(component.showControls).toBe(false);
        expect(component.showPersonalityPicker).toBe(false);
        expect(component.personalityPickerLoading).toBe(false);
        expect(component.personalityPickerError).toBe(false);
        expect(
          document.querySelector('.appearance-menu-overlay-host')
        ).toBeNull();
        expect(
          document.querySelector('.personality-picker-overlay-host')
        ).toBeNull();
        expect(backgroundButton.getAttribute('inert')).toBe('previous');
        expect(backgroundButton.getAttribute('aria-hidden')).toBe('false');
        expect(focusSpy).not.toHaveBeenCalled();
        focusSpy.mockRestore();
      } finally {
        fixture.destroy();
        backgroundButton.remove();
      }
    });
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('opens and closes the compact appearance menu', () => {
    expect(component.showControls).toBe(false);

    component.toggleControls();
    expect(component.showControls).toBe(true);

    component.closeControls();
    expect(component.showControls).toBe(false);
  });

  it('closes appearance controls when Escape is pressed', () => {
    component.showControls = true;

    component.handleEscape();

    expect(component.showControls).toBe(false);
  });

  it('opens the appearance menu from its trigger', () => {
    const trigger = fixture.nativeElement.querySelector(
      '.appearance-trigger'
    ) as HTMLButtonElement;

    trigger.click();
    fixture.detectChanges();

    expect(component.showControls).toBe(true);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(appearanceMenu()?.getAttribute('aria-modal')).toBeNull();
  });

  it('tracks the persisted theme service mode in the selector', () => {
    const themeService = TestBed.inject(ThemeService);
    component.toggleControls();
    fixture.detectChanges();
    const checkbox = document.querySelector(
      'input[type="checkbox"]'
    ) as HTMLInputElement;

    themeService.setTheme('dark');
    fixture.detectChanges();

    expect(component.theme).toBe('dark');
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute('aria-label')).toContain(
      'Dark theme selected'
    );

    themeService.setTheme('light');
    fixture.detectChanges();

    expect(component.theme).toBe('light');
    expect(checkbox.checked).toBe(false);
    expect(checkbox.getAttribute('aria-label')).toContain(
      'Light theme selected'
    );
  });

  it('closes the rendered appearance menu from its close button', () => {
    component.toggleControls();
    fixture.detectChanges();

    const closeButton = appearanceMenu()?.querySelector(
      '.appearance-close'
    ) as HTMLButtonElement;
    expect(closeButton).toBeTruthy();

    closeButton.click();
    fixture.detectChanges();

    expect(component.showControls).toBe(false);
  });

  it('closes the appearance menu when clicked outside it', () => {
    component.toggleControls();
    fixture.detectChanges();

    document.body.click();
    fixture.detectChanges();

    expect(component.showControls).toBe(false);
  });

  it('keeps the personality trigger before controls that can be clipped by a menu sheet', () => {
    component.toggleControls();
    fixture.detectChanges();

    const fieldset = appearanceMenu()?.querySelector(
      'fieldset'
    ) as HTMLFieldSetElement | null;
    const personality = fieldset?.querySelector('.personality-selector');
    const themeSwitch = fieldset?.querySelector('.theme-switch');
    const accentPicker = fieldset?.querySelector('.accent-picker');

    expect(personality).toBeTruthy();
    expect(themeSwitch).toBeTruthy();
    expect(accentPicker).toBeTruthy();
    expect(
      personality!.compareDocumentPosition(themeSwitch!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      personality!.compareDocumentPosition(accentPicker!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('exposes stable dialog state from the personality trigger', () => {
    component.toggleControls();
    fixture.detectChanges();

    const trigger = personalityTrigger() as HTMLButtonElement;
    expect(trigger.getAttribute('aria-haspopup')).toBe('dialog');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(
      component.personalityPickerId
    );

    component.openPersonalityPicker();
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(document.getElementById(component.personalityPickerId)).toBeTruthy();
  });

  it('restores focus to the live nested trigger before the appearance trigger', async () => {
    const loader: PersonalityPickerLoader = () =>
      Promise.resolve(PersonalityPickerHostComponent);
    const pickerFixture = await (async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [ThemeToggleComponent],
        providers: [
          {
            provide: THEME_PERSONALITY_PICKER_LOADER,
            useValue: loader,
          },
        ],
      }).compileComponents();
      const createdFixture = TestBed.createComponent(ThemeToggleComponent);
      createdFixture.detectChanges();
      return createdFixture;
    })();
    const pickerComponent = pickerFixture.componentInstance;

    const appearanceTrigger = pickerFixture.nativeElement.querySelector(
      '.appearance-trigger'
    ) as HTMLButtonElement;
    appearanceTrigger.click();
    pickerFixture.detectChanges();
    const personalityTrigger = document.querySelector(
      '.appearance-menu-overlay-host .personality-trigger'
    ) as HTMLButtonElement;
    personalityTrigger.click();
    await pickerFixture.whenStable();
    pickerFixture.detectChanges();
    await pickerFixture.whenStable();

    const dialog = document.getElementById(
      pickerComponent.personalityPickerId
    ) as HTMLElement;
    const dialogFocusables = dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled])'
    );
    expect(document.activeElement).toBe(dialogFocusables[0]);
    dialogFocusables[0].dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
      })
    );
    expect(document.activeElement).toBe(
      dialogFocusables[dialogFocusables.length - 1]
    );

    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    pickerFixture.detectChanges();
    await pickerFixture.whenStable();

    expect(pickerComponent.showPersonalityPicker).toBe(false);
    expect(pickerComponent.showControls).toBe(true);
    expect(document.activeElement).toBe(personalityTrigger);

    pickerComponent.openPersonalityPicker();
    pickerFixture.detectChanges();
    await pickerFixture.whenStable();
    pickerFixture.detectChanges();
    pickerComponent.closeControls();
    pickerFixture.detectChanges();
    await pickerFixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(pickerComponent.showControls).toBe(false);
    expect(pickerComponent.showPersonalityPicker).toBe(false);
    expect(document.activeElement).toBe(appearanceTrigger);
  });

  it('mounts the picker portal outside clipped menu ancestors', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [
        {
          provide: THEME_PERSONALITY_PICKER_LOADER,
          useValue: () => Promise.resolve(PersonalityPickerHostComponent),
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ThemeToggleComponent);
    const clippedAncestor = document.createElement('div');
    const backgroundButton = document.createElement('button');
    backgroundButton.textContent = 'Background';
    backgroundButton.setAttribute('inert', 'previous');
    backgroundButton.setAttribute('aria-hidden', 'false');
    document.body.appendChild(backgroundButton);
    clippedAncestor.className = 'clipped-ancestor';
    clippedAncestor.style.cssText =
      'height: 4rem; overflow: hidden; transform: translateZ(0);';
    document.body.appendChild(clippedAncestor);
    clippedAncestor.appendChild(fixture.nativeElement);

    try {
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.appearance-trigger').click();
      fixture.detectChanges();
      (
        document.querySelector(
          '.appearance-menu-overlay-host .personality-trigger'
        ) as HTMLButtonElement
      ).click();
      await fixture.whenStable();
      fixture.detectChanges();
      await fixture.whenStable();

      const portal = document.querySelector(
        '.personality-picker-overlay-host'
      ) as HTMLElement;
      const dialog = portal.querySelector('[role="dialog"]') as HTMLElement;

      expect(portal.parentElement).toBe(document.body);
      expect(portal.closest('.clipped-ancestor')).toBeNull();
      expect(backgroundButton.getAttribute('inert')).toBe('');
      expect(backgroundButton.getAttribute('aria-hidden')).toBe('true');
      expect(
        document.getElementById(fixture.componentInstance.personalityPickerId)
      ).toBe(dialog);
      expect(dialog.getAttribute('aria-labelledby')).toBe(
        fixture.componentInstance.personalityPickerTitleId
      );
      expect(
        document.getElementById(
          fixture.componentInstance.personalityPickerTitleId
        )
      ).toBeTruthy();

      fixture.componentInstance.closePersonalityPicker();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(backgroundButton.getAttribute('inert')).toBe('previous');
      expect(backgroundButton.getAttribute('aria-hidden')).toBe('false');
    } finally {
      fixture.destroy();
      backgroundButton.remove();
      clippedAncestor.remove();
    }
  });

  it('mounts the appearance portal outside clipped menu ancestors', () => {
    const clippedAncestor = document.createElement('div');
    clippedAncestor.className = 'clipped-ancestor';
    clippedAncestor.style.cssText =
      'height: 4rem; overflow: hidden; transform: translateZ(0);';
    document.body.appendChild(clippedAncestor);

    const fixture = TestBed.createComponent(ThemeToggleComponent);
    clippedAncestor.appendChild(fixture.nativeElement);

    try {
      fixture.detectChanges();
      (
        fixture.nativeElement.querySelector(
          '.appearance-trigger'
        ) as HTMLButtonElement
      ).click();
      fixture.detectChanges();

      const portal = document.querySelector(
        '.appearance-menu-overlay-host'
      ) as HTMLElement;
      const menu = portal.querySelector('.toggle-container') as HTMLElement;

      expect(portal.parentElement).toBe(document.body);
      expect(portal.closest('.clipped-ancestor')).toBeNull();
      expect(menu.id).toBe(fixture.componentInstance.controlsId);
      expect(menu.getAttribute('role')).toBe('dialog');
    } finally {
      fixture.destroy();
      clippedAncestor.remove();
    }
  });

  it('keeps background isolation until multiple picker owners close', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ThemeToggleComponent],
      providers: [
        {
          provide: THEME_PERSONALITY_PICKER_LOADER,
          useValue: () => Promise.resolve(PersonalityPickerHostComponent),
        },
      ],
    }).compileComponents();

    const first = TestBed.createComponent(ThemeToggleComponent);
    const second = TestBed.createComponent(ThemeToggleComponent);
    const backgroundButton = document.createElement('button');
    backgroundButton.setAttribute('aria-hidden', 'false');
    document.body.appendChild(backgroundButton);

    try {
      first.detectChanges();
      second.detectChanges();
      first.componentInstance.openPersonalityPicker();
      second.componentInstance.openPersonalityPicker();
      await first.whenStable();
      await second.whenStable();

      expect(backgroundButton.hasAttribute('inert')).toBe(true);
      first.componentInstance.closePersonalityPicker();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(backgroundButton.hasAttribute('inert')).toBe(true);

      second.componentInstance.closePersonalityPicker();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(backgroundButton.hasAttribute('inert')).toBe(false);
      expect(backgroundButton.getAttribute('aria-hidden')).toBe('false');
    } finally {
      first.destroy();
      second.destroy();
      backgroundButton.remove();
    }
  });
});
