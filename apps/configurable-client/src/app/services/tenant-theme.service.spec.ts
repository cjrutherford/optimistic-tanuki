import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import type { ThemeConfig } from '@optimistic-tanuki/app-config-models';

import { TenantThemeService } from './tenant-theme.service';

describe('TenantThemeService', () => {
  let themeServiceStub: {
    setTheme: jest.Mock;
    setPersonality: jest.Mock;
    setPrimaryColor: jest.Mock;
  };
  let setPersonalityResolve: () => void;

  function configure(platform: 'browser' | 'server' = 'browser') {
    // setPersonality is intentionally controllable so tests can verify
    // the "await before overrides" ordering contract.
    themeServiceStub = {
      setTheme: jest.fn(),
      setPersonality: jest.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            setPersonalityResolve = resolve;
          })
      ),
      setPrimaryColor: jest.fn(),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        TenantThemeService,
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    document.documentElement.removeAttribute('style');
    document.getElementById('tenant-custom-theme-css')?.remove();
  }

  afterEach(() => {
    document.documentElement.removeAttribute('style');
    document.getElementById('tenant-custom-theme-css')?.remove();
  });

  it('is a no-op on the server', async () => {
    configure('server');
    const service = TestBed.inject(TenantThemeService);
    await service.apply({ mode: 'dark', personalityId: 'bold' });
    expect(themeServiceStub.setTheme).not.toHaveBeenCalled();
    expect(themeServiceStub.setPersonality).not.toHaveBeenCalled();
  });

  it('applies foundation defaults when theme is undefined', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);
    const pending = service.apply(undefined);
    setPersonalityResolve();
    await pending;

    expect(themeServiceStub.setTheme).toHaveBeenCalledWith('light');
    expect(themeServiceStub.setPersonality).toHaveBeenCalledWith('foundation');
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalledWith('#356c91');
  });

  it('applyDefaults() delegates to apply(undefined)', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);
    const pending = service.applyDefaults();
    setPersonalityResolve();
    await pending;

    expect(themeServiceStub.setPersonality).toHaveBeenCalledWith('foundation');
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalledWith('#356c91');
  });

  it('routes mode/personality/primaryColor through ThemeService', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);

    const config: ThemeConfig = {
      mode: 'dark',
      personalityId: 'electric',
      primaryColor: '#ff00aa',
    };
    const pending = service.apply(config);
    setPersonalityResolve();
    await pending;

    expect(themeServiceStub.setTheme).toHaveBeenCalledWith('dark');
    expect(themeServiceStub.setPersonality).toHaveBeenCalledWith('electric');
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalledWith('#ff00aa');
  });

  it('awaits setPersonality BEFORE applying explicit tenant overrides', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);

    const pending = service.apply({
      personalityId: 'electric',
      secondaryColor: '#112233',
    });

    // setPersonality is in-flight; setPrimaryColor and direct overrides
    // must not have run yet, otherwise the personality's awaited write
    // would clobber them.
    await Promise.resolve();
    expect(themeServiceStub.setPrimaryColor).not.toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--secondary')).toBe(
      ''
    );

    setPersonalityResolve();
    await pending;

    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalled();
    expect(document.documentElement.style.getPropertyValue('--secondary')).toBe(
      '#112233'
    );
  });

  it('writes tenant overrides onto the canonical ThemeService tokens', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);

    const pending = service.apply({
      secondaryColor: '#112233',
      backgroundColor: '#fefefe',
      textColor: '#0a0a0a',
      fontFamily: '"Tenant Sans", system-ui, sans-serif',
    });
    setPersonalityResolve();
    await pending;

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--secondary')).toBe('#112233');
    expect(root.style.getPropertyValue('--background')).toBe('#fefefe');
    expect(root.style.getPropertyValue('--foreground')).toBe('#0a0a0a');
    expect(root.style.getPropertyValue('--font-body')).toBe(
      '"Tenant Sans", system-ui, sans-serif'
    );
  });

  it('injects sanitized customCss into a singleton style element', async () => {
    configure();
    const service = TestBed.inject(TenantThemeService);

    let pending = service.apply({
      customCss: '.tenant-banner { color: red; }',
    });
    setPersonalityResolve();
    await pending;

    const first = document.getElementById(
      'tenant-custom-theme-css'
    ) as HTMLStyleElement | null;
    expect(first).not.toBeNull();
    expect(first?.textContent).toBe('.tenant-banner { color: red; }');

    pending = service.apply({ customCss: '.tenant-banner { color: blue; }' });
    setPersonalityResolve();
    await pending;

    const second = document.getElementById(
      'tenant-custom-theme-css'
    ) as HTMLStyleElement | null;
    expect(second).toBe(first); // same node, updated in place
    expect(second?.textContent).toBe('.tenant-banner { color: blue; }');
  });

  describe('sanitizeCustomCss', () => {
    it.each<[string, string]>([
      ['@import "https://attacker/p.css";', '@import'],
      [
        "@font-face { font-family: 'X'; src: url(https://attacker/x.woff); }",
        '@font-face',
      ],
      [
        '.brand { position: fixed; inset: 0; background: #000; }',
        'position: fixed',
      ],
      [
        '.brand { position : sticky; top: 0; }',
        'position: sticky (whitespace variant)',
      ],
      ['.brand::before { content: "Verified"; }', 'content:'],
      [
        'input[name="csrf"][value^="a"] { background: url(//attacker/a); }',
        'attribute selector on form field',
      ],
      [
        '.brand { background: url(https://attacker/pixel.png); }',
        'url() to non-data:image',
      ],
      ['.brand { background: url("javascript:alert(1)"); }', 'javascript: URI'],
      ['.brand { width: expression(alert(1)); }', 'expression()'],
      ['.brand { z-index: 2147483647; }', 'extreme z-index'],
    ])('rejects %s (%s)', (input) => {
      expect(TenantThemeService.sanitizeCustomCss(input)).toBeNull();
    });

    it('rejects payloads exceeding the length cap', () => {
      const huge = '.x{}'.repeat(6000); // 24 KB
      expect(TenantThemeService.sanitizeCustomCss(huge)).toBeNull();
    });

    it('accepts safe brand CSS', () => {
      const safe =
        '.tenant-banner { color: var(--primary); font-weight: 600; } ' +
        '.tenant-banner img { background: url("data:image/svg+xml,..."); }';
      expect(TenantThemeService.sanitizeCustomCss(safe)).toBe(safe);
    });

    it('skips DOM injection when sanitization rejects', async () => {
      configure();
      const service = TestBed.inject(TenantThemeService);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const pending = service.apply({
        customCss: '.x { position: fixed; inset: 0; }',
      });
      setPersonalityResolve();
      await pending;

      expect(document.getElementById('tenant-custom-theme-css')).toBeNull();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('customCss rejected')
      );
      warnSpy.mockRestore();
    });
  });
});
