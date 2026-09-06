import { TestBed } from '@angular/core/testing';
import { Personality, PersonalityFonts } from '@optimistic-tanuki/theme-models';
import { FontLoadingService } from './font-loading.service';

describe('FontLoadingService', () => {
  let service: FontLoadingService;
  let appendChildSpy: jest.SpyInstance;

  const fonts: PersonalityFonts = {
    heading: { family: 'Poppins, system-ui, sans-serif', weights: [400, 700] },
    body: { family: 'Arial, sans-serif', weights: [400] },
    mono: {
      family: '"JetBrains Mono", monospace',
      weights: [400],
      preload: true,
    },
    accent: { family: 'Nonexistent Family, sans-serif', weights: [400] },
  };

  const personality = { id: 'test-personality', fonts } as Personality;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FontLoadingService);
    service.reset();

    document.querySelectorAll('link[id^="font-"]').forEach((el) => el.remove());
    document.documentElement.removeAttribute('style');

    // jsdom never fires load/error events for appended <link> elements, so
    // simulate success as soon as a font stylesheet link is appended.
    appendChildSpy = jest
      .spyOn(document.head, 'appendChild')
      .mockImplementation(((node: Node) => {
        const el = node as HTMLLinkElement;
        if (el.rel === 'stylesheet' && el.id?.startsWith('font-')) {
          queueMicrotask(() => el.onload?.(new Event('load')));
        }
        return Node.prototype.appendChild.call(document.head, node);
      }) as typeof document.head.appendChild);
  });

  afterEach(() => {
    appendChildSpy.mockRestore();
  });

  it('loads all font slots for a personality and reports success', async () => {
    const results = await service.loadPersonalityFonts(personality);

    expect(results).toHaveLength(4);
    expect(results.every((r) => r.loaded)).toBe(true);
    expect(service.getLoadedFonts()).toContain(
      'Poppins, system-ui, sans-serif'
    );
  });

  it('treats system fonts as already loaded without a network request', async () => {
    const results = await service.loadPersonalityFonts({
      id: 'system-only',
      fonts: { body: { family: 'Georgia, serif', weights: [400] } },
    } as Personality);

    expect(results).toEqual([{ family: 'Georgia, serif', loaded: true }]);
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  it('reuses an already-loaded font without appending a new link', async () => {
    await service.loadPersonalityFonts(personality);
    appendChildSpy.mockClear();

    const results = await service.loadPersonalityFonts(personality);
    expect(results.every((r) => r.loaded)).toBe(true);
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  it('reuses an in-flight load promise for concurrent requests', async () => {
    const [first, second] = await Promise.all([
      service.loadPersonalityFonts(personality),
      service.loadPersonalityFonts(personality),
    ]);

    expect(first.every((r) => r.loaded)).toBe(true);
    expect(second.every((r) => r.loaded)).toBe(true);
  });

  it('resolves without loading an unrecognized, non-system font family', async () => {
    const results = await service.loadPersonalityFonts({
      id: 'unknown-font',
      fonts: {
        body: { family: 'Totally Made Up Font', weights: [400] },
      },
    } as Personality);

    expect(results).toEqual([{ family: 'Totally Made Up Font', loaded: true }]);
  });

  it('reports a failed font load with the underlying error message', async () => {
    appendChildSpy.mockImplementation(((node: Node) => {
      const el = node as HTMLLinkElement;
      if (el.rel === 'stylesheet' && el.id?.startsWith('font-')) {
        queueMicrotask(() => el.onerror?.(new Event('error')));
      }
      return Node.prototype.appendChild.call(document.head, node);
    }) as typeof document.head.appendChild);

    const results = await service.loadPersonalityFonts({
      id: 'broken',
      fonts: { body: { family: 'Poppins', weights: [400] } },
    } as Personality);

    expect(results[0].loaded).toBe(false);
    expect(results[0].error).toContain('Failed to load font');
  });

  it('adds a preload link when a font config requests it', async () => {
    await service.loadPersonalityFonts(personality);
    const preloadCalls = appendChildSpy.mock.calls.filter(
      ([node]) => (node as HTMLLinkElement).rel === 'preload'
    );
    expect(preloadCalls.length).toBeGreaterThan(0);
  });

  it('applies and removes font CSS custom properties', () => {
    service.applyFontVariables(personality);
    const root = document.documentElement;
    expect(root.style.getPropertyValue('--font-heading')).toBe(
      'Poppins, system-ui, sans-serif'
    );
    expect(root.style.getPropertyValue('--font-body')).toBe(
      'Arial, sans-serif'
    );
    expect(root.style.getPropertyValue('--font-mono')).toBe(
      '"JetBrains Mono", monospace'
    );
    expect(root.style.getPropertyValue('--font-family-base')).toBe(
      'Arial, sans-serif'
    );

    service.removeFontVariables();
    expect(root.style.getPropertyValue('--font-heading')).toBe('');
    expect(root.style.getPropertyValue('--font-body')).toBe('');
  });

  it('applies only the body font variable when others are absent', () => {
    service.applyFontVariables({
      id: 'body-only',
      fonts: { body: { family: 'Arial, sans-serif', weights: [400] } },
    } as Personality);

    const root = document.documentElement;
    expect(root.style.getPropertyValue('--font-heading')).toBe('');
    expect(root.style.getPropertyValue('--font-body')).toBe(
      'Arial, sans-serif'
    );
  });

  it('preloadFonts adds preload links only for preloadable google fonts not already present', () => {
    service.preloadFonts(fonts);
    const preloadLinks = document.head.querySelectorAll(
      'link[id^="font-preload-"]'
    );
    expect(preloadLinks.length).toBeGreaterThan(0);

    const before = document.head.querySelectorAll(
      'link[id^="font-preload-"]'
    ).length;
    service.preloadFonts(fonts);
    const after = document.head.querySelectorAll(
      'link[id^="font-preload-"]'
    ).length;
    expect(after).toBe(before);
  });

  it('preloadFonts skips fonts without a preload flag', () => {
    service.preloadFonts({
      body: { family: 'Poppins, sans-serif', weights: [400] },
    });
    expect(
      document.head.querySelectorAll('link[id^="font-preload-"]').length
    ).toBe(0);
  });

  it('reports whether all fonts for a personality have finished loading', async () => {
    expect(await service.areFontsLoaded(personality)).toBe(false);
    await service.loadPersonalityFonts(personality);
    expect(await service.areFontsLoaded(personality)).toBe(true);
  });

  it('reset clears loaded fonts and in-flight promises', async () => {
    await service.loadPersonalityFonts(personality);
    expect(service.getLoadedFonts().length).toBeGreaterThan(0);
    service.reset();
    expect(service.getLoadedFonts()).toEqual([]);
  });
});
