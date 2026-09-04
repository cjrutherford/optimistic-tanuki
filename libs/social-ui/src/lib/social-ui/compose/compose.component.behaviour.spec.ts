import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { ImageUploadService } from '@optimistic-tanuki/compose-lib';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ComposeComponent } from './compose.component';
import { ComponentInjectionService } from './services/component-injection.service';

/**
 * The spec beside this one covers the ControlValueAccessor contract. These
 * drive the rest of the component: the registry delegation, the inline
 * component actions, image upload down both its callback and asset-service
 * paths, and submit validation.
 *
 * A real fixture is used rather than a bare instance because the component
 * builds a live tiptap editor in ngAfterViewInit, and most of these methods
 * issue editor commands.
 */
describe('ComposeComponent behaviour', () => {
  let component: ComposeComponent;
  let fixture: ComponentFixture<ComposeComponent>;
  let uploads: {
    uploadFile: jest.Mock;
    extractBase64Images: jest.Mock;
    replaceImageUrls: jest.Mock;
  };

  const injectable = (id: string, overrides: Record<string, unknown> = {}) =>
    ({
      id,
      name: id,
      category: 'content',
      component: class {},
      data: {},
      ...overrides,
    } as never);

  beforeEach(async () => {
    uploads = {
      uploadFile: jest.fn().mockResolvedValue('/assets/uploaded.png'),
      extractBase64Images: jest.fn().mockReturnValue([]),
      replaceImageUrls: jest.fn((html: string) => html),
    };

    await TestBed.configureTestingModule({
      imports: [ComposeComponent, NoopAnimationsModule],
      providers: [
        ComponentInjectionService,
        ThemeService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
      ],
    })
      // The component lists ImageUploadService in its own `providers`, so a
      // module-level override would be shadowed by the component injector.
      .overrideComponent(ComposeComponent, {
        add: {
          providers: [{ provide: ImageUploadService, useValue: uploads }],
        },
        remove: { providers: [ImageUploadService] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ComposeComponent);
    component = fixture.componentInstance;
    // ngAfterViewInit registers the default components, which would otherwise
    // trip the dev-mode changed-after-checked guard.
    fixture.changeDetectorRef.detectChanges();

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(window, 'alert').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fixture.destroy();
  });

  describe('component registry', () => {
    it('registers a component and refreshes the local list', () => {
      const before = component.getRegisteredComponents().length;

      component.registerComponent(injectable('my-widget'));

      expect(component.getRegisteredComponents().map((c) => c.id)).toContain(
        'my-widget'
      );
      expect(component.registeredComponents).toHaveLength(before + 1);
    });

    it('unregisters and refreshes again', () => {
      component.registerComponent(injectable('my-widget'));

      component.unregisterComponent('my-widget');

      expect(
        component.getRegisteredComponents().map((c) => c.id)
      ).not.toContain('my-widget');
    });

    it('filters the registry by category', () => {
      component.registerComponent(
        injectable('chart-widget', { category: 'data' })
      );

      const data = component.getComponentsByCategory('data');

      expect(data.map((c) => c.id)).toContain('chart-widget');
      expect(component.getComponentsByCategory('nothing-here')).toEqual([]);
    });

    it('ships default components out of the box', () => {
      expect(component.getRegisteredComponents().length).toBeGreaterThan(0);
    });
  });

  describe('injectComponent', () => {
    it('refuses an id that is not registered', async () => {
      await expect(
        component.injectComponent('never-registered')
      ).rejects.toThrow('Component never-registered not found');
    });
  });

  describe('active component bookkeeping', () => {
    const instance = (instanceId: string, data: Record<string, unknown> = {}) =>
      ({
        instanceId,
        componentDef: injectable('callout'),
        componentRef: {} as never,
        data,
      } as never);

    it('tracks, reads back and removes an instance', () => {
      component.activeComponents.set('a-1', instance('a-1'));

      expect(component.getComponent('a-1')).toBeDefined();
      expect(component.getActiveComponents()).toHaveLength(1);

      component.removeComponent('a-1');

      expect(component.getComponent('a-1')).toBeUndefined();
      expect(component.getActiveComponents()).toEqual([]);
    });

    it('merges new data into an existing instance rather than replacing it', () => {
      component.activeComponents.set(
        'a-1',
        instance('a-1', { title: 'One', keep: true })
      );

      component.updateComponent('a-1', { title: 'Two' });

      expect(component.getComponent('a-1')?.data).toEqual({
        title: 'Two',
        keep: true,
      });
    });

    it('ignores an update for an instance it does not hold', () => {
      expect(() =>
        component.updateComponent('missing', { title: 'x' })
      ).not.toThrow();
    });
  });

  describe('component selector visibility', () => {
    it('opens and closes', () => {
      component.displayComponentSelector();
      expect(component.isComponentSelectorVisible).toBe(true);

      component.hideComponentSelector();
      expect(component.isComponentSelectorVisible).toBe(false);
    });

    it('opens from the toolbar button', () => {
      component.onToolbarComponentsClick();

      expect(component.isComponentSelectorVisible).toBe(true);
    });
  });

  describe('inline component actions', () => {
    const instance = (instanceId: string) =>
      ({
        instanceId,
        componentDef: injectable('callout'),
        componentRef: {} as never,
        data: {},
      } as never);

    it('delete drops the instance from the active map', () => {
      component.activeComponents.set('a-1', instance('a-1'));

      component.onComponentDelete(instance('a-1'));

      expect(component.getComponent('a-1')).toBeUndefined();
    });

    it('inline delete does the same by id', () => {
      component.activeComponents.set('a-1', instance('a-1'));

      component.onInlineComponentDelete('a-1');

      expect(component.getComponent('a-1')).toBeUndefined();
    });

    it('move up only fires when something sits above', () => {
      const move = jest.spyOn(component, 'moveComponent');
      component.activeComponents.set('a-1', instance('a-1'));
      component.activeComponents.set('a-2', instance('a-2'));

      component.onComponentMoveUp(instance('a-1'));
      expect(move).not.toHaveBeenCalled();

      component.onComponentMoveUp(instance('a-2'));
      expect(move).toHaveBeenCalledWith('a-2', 0);
    });

    it('move down only fires when something sits below', () => {
      const move = jest.spyOn(component, 'moveComponent');
      component.activeComponents.set('a-1', instance('a-1'));
      component.activeComponents.set('a-2', instance('a-2'));

      component.onComponentMoveDown(instance('a-2'));
      expect(move).not.toHaveBeenCalled();

      component.onComponentMoveDown(instance('a-1'));
      expect(move).toHaveBeenCalledWith('a-1', 1);
    });

    it('config routes through to edit', () => {
      const edit = jest.spyOn(component, 'onComponentEdit');

      component.onComponentConfig(instance('a-1'));

      expect(edit).toHaveBeenCalled();
    });

    it('an inline click edits the matching instance and ignores an unknown id', () => {
      const edit = jest.spyOn(component, 'onComponentEdit');
      component.activeComponents.set('a-1', instance('a-1'));

      component.onInlineComponentClick('callout', 'a-1');
      expect(edit).toHaveBeenCalledTimes(1);

      component.onInlineComponentClick('callout', 'nope');
      expect(edit).toHaveBeenCalledTimes(1);
    });

    it('an inline edit does the same', () => {
      const edit = jest.spyOn(component, 'onComponentEdit');
      component.activeComponents.set('a-1', instance('a-1'));

      component.onInlineComponentEdit('a-1');
      expect(edit).toHaveBeenCalledTimes(1);

      component.onInlineComponentEdit('nope');
      expect(edit).toHaveBeenCalledTimes(1);
    });

    it('duplicating re-runs selection for the same component definition', async () => {
      const selected = jest
        .spyOn(component, 'onComponentSelected')
        .mockResolvedValue(undefined);
      const def = component.getRegisteredComponents()[0];

      component.onComponentDuplicate({
        instanceId: 'a-1',
        componentDef: def,
        componentRef: {} as never,
        data: {},
      } as never);

      expect(selected).toHaveBeenCalledWith(def);
    });

    it('duplicating an unregistered definition does nothing', () => {
      const selected = jest.spyOn(component, 'onComponentSelected');

      component.onComponentDuplicate({
        instanceId: 'a-1',
        componentDef: injectable('not-registered'),
        componentRef: {} as never,
        data: {},
      } as never);

      expect(selected).not.toHaveBeenCalled();
    });

    it('a property change updates the instance and emits for the form', () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      component.activeComponents.set('a-1', instance('a-1'));

      component.onComponentPropertiesChanged({
        instance: instance('a-1'),
        data: { title: 'Edited' },
      } as never);

      expect(component.getComponent('a-1')?.data).toMatchObject({
        title: 'Edited',
      });
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('onComponentSelected', () => {
    it('records the instance, closes the selector and emits', async () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      component.displayComponentSelector();
      const def = component.getRegisteredComponents()[0];

      await component.onComponentSelected(def);

      expect(component.getActiveComponents()).toHaveLength(1);
      expect(component.isComponentSelectorVisible).toBe(false);
      expect(onChange).toHaveBeenCalled();
    });

    it('gives each insertion its own instance id', async () => {
      const def = component.getRegisteredComponents()[0];

      await component.onComponentSelected(def);
      await component.onComponentSelected(def);

      const ids = component.getActiveComponents().map((c) => c.instanceId);
      expect(new Set(ids).size).toBe(2);
    });
  });

  describe('drag state', () => {
    const dragEvent = () => ({ preventDefault: jest.fn() } as unknown as Event);

    it('turns on for enter and over, off for leave', () => {
      component.handleDragEnter(dragEvent());
      expect(component.isDragOver).toBe(true);

      component.handleDragLeave(dragEvent());
      expect(component.isDragOver).toBe(false);

      component.handleDragOver(dragEvent());
      expect(component.isDragOver).toBe(true);
    });
  });

  describe('handleDrop', () => {
    const drop = (files: unknown[]) =>
      ({
        preventDefault: jest.fn(),
        dataTransfer: { files },
      } as unknown as DragEvent);

    const imageFile = (name = 'a.png') => ({ name, type: 'image/png' } as File);

    it('clears the drag state and does nothing without files', async () => {
      component.isDragOver = true;

      await component.handleDrop(drop([]));

      expect(component.isDragOver).toBe(false);
      expect(uploads.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a drop that carries no images', async () => {
      await component.handleDrop(
        drop([{ name: 'a.pdf', type: 'application/pdf' }])
      );

      expect(window.alert).toHaveBeenCalledWith('Please drop image files only');
      expect(uploads.uploadFile).not.toHaveBeenCalled();
    });

    it('uploads each dropped image through the asset service', async () => {
      component.profileId = 'profile-1';

      await component.handleDrop(
        drop([imageFile('a.png'), imageFile('b.png')])
      );

      expect(uploads.uploadFile).toHaveBeenCalledTimes(2);
      expect(uploads.uploadFile.mock.calls[0][1]).toBe('profile-1');
    });

    it('refuses to upload without a profile id', async () => {
      component.profileId = undefined;

      await component.handleDrop(drop([imageFile()]));

      expect(uploads.uploadFile).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(
        'Unable to upload image: User profile not found'
      );
    });

    it('reports a failed upload per file rather than aborting the loop', async () => {
      component.profileId = 'profile-1';
      uploads.uploadFile.mockRejectedValue(new Error('bucket down'));

      await component.handleDrop(
        drop([imageFile('a.png'), imageFile('b.png')])
      );

      expect(uploads.uploadFile).toHaveBeenCalledTimes(2);
      expect(window.alert).toHaveBeenCalledWith(
        'Failed to upload a.png. Please try again.'
      );
    });
  });

  describe('onFileSelected', () => {
    const changeEvent = (files: unknown[]) =>
      ({
        target: { files, value: 'C:/fake/a.png' },
      } as unknown as Event);

    it('does nothing when the picker was dismissed', async () => {
      await component.onFileSelected(changeEvent([]));

      expect(uploads.uploadFile).not.toHaveBeenCalled();
    });

    it('uploads through the asset service and clears the input', async () => {
      component.profileId = 'profile-1';
      const event = changeEvent([{ name: 'a.png', type: 'image/png' }]);

      await component.onFileSelected(event);

      expect(uploads.uploadFile).toHaveBeenCalled();
      expect((event.target as HTMLInputElement).value).toBe('');
    });

    it('refuses without a profile id', async () => {
      component.profileId = undefined;

      await component.onFileSelected(
        changeEvent([{ name: 'a.png', type: 'image/png' }])
      );

      expect(uploads.uploadFile).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(
        'Unable to upload image: User profile not found'
      );
    });

    it('reports an upload failure and still clears the input', async () => {
      component.profileId = 'profile-1';
      uploads.uploadFile.mockRejectedValue(new Error('bucket down'));
      const event = changeEvent([{ name: 'a.png', type: 'image/png' }]);

      await component.onFileSelected(event);

      expect(window.alert).toHaveBeenCalledWith(
        'Failed to upload image. Please try again.'
      );
      expect((event.target as HTMLInputElement).value).toBe('');
    });
  });

  describe('onPostSubmit validation', () => {
    const validContent = '<p>' + 'x'.repeat(40) + '</p>';

    it('rejects a title under five characters without emitting', () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'abc';
      component.content = validContent;

      component.onPostSubmit();

      expect(component.titleError).toBe('Title must be at least 5 characters');
      expect(emitted).not.toHaveBeenCalled();
    });

    it('rejects content under twenty characters of text', () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      component.content = '<p>too short</p>';

      component.onPostSubmit();

      expect(component.contentError).toBe(
        'Content must be at least 20 characters'
      );
      expect(emitted).not.toHaveBeenCalled();
    });

    it('measures length on the text, not the markup', () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      // Plenty of characters, but almost all of them are tags.
      component.content = '<p><strong><em>short</em></strong></p>';

      component.onPostSubmit();

      expect(component.contentError).toBe(
        'Content must be at least 20 characters'
      );
    });

    it('emits the post once both fields pass', async () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      component.content = validContent;
      component.links = [{ url: 'https://example.test' }];

      await component.onPostSubmit();

      expect(emitted).toHaveBeenCalledTimes(1);
      expect(emitted.mock.calls[0][0]).toMatchObject({
        title: 'A good title',
        links: [{ url: 'https://example.test' }],
      });
      expect(component.titleError).toBe('');
      expect(component.contentError).toBe('');
    });

    it('carries the post-specific theme through', async () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      component.content = validContent;
      component.updatePostTheme('dark');
      component.updatePostAccentColor('#ff0000');

      await component.onPostSubmit();

      expect(emitted.mock.calls[0][0].themeConfig).toEqual({
        theme: 'dark',
        accentColor: '#ff0000',
      });
    });

    it('swaps base64 images for uploaded urls when a callback is supplied', async () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      component.content = validContent;
      component.imageUploadCallback = jest
        .fn()
        .mockResolvedValue('/assets/a.png') as never;
      uploads.extractBase64Images.mockReturnValue([
        { dataUrl: 'data:image/png;base64,AAA' },
      ]);
      uploads.replaceImageUrls.mockReturnValue('<p>replaced</p>');

      await component.onPostSubmit();

      expect(uploads.replaceImageUrls).toHaveBeenCalledWith(validContent, [
        { dataUrl: 'data:image/png;base64,AAA', assetUrl: '/assets/a.png' },
      ]);
      expect(emitted.mock.calls[0][0].content).toBe('<p>replaced</p>');
    });

    it('still posts when an image upload fails', async () => {
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.title = 'A good title';
      component.content = validContent;
      component.imageUploadCallback = jest
        .fn()
        .mockRejectedValue(new Error('upload failed')) as never;
      uploads.extractBase64Images.mockReturnValue([
        { dataUrl: 'data:image/png;base64,AAA' },
      ]);

      await component.onPostSubmit();

      expect(emitted).toHaveBeenCalledTimes(1);
      // Nothing uploaded, so the original content survives untouched.
      expect(uploads.replaceImageUrls).not.toHaveBeenCalled();
    });

    it('leaves content alone when there are no base64 images', async () => {
      component.postSubmitted.subscribe(jest.fn());
      component.title = 'A good title';
      component.content = validContent;
      component.imageUploadCallback = jest.fn() as never;

      await component.onPostSubmit();

      expect(uploads.replaceImageUrls).not.toHaveBeenCalled();
    });
  });

  describe('resetEditor', () => {
    it('clears every field and the active components', () => {
      component.title = 'Something';
      component.content = '<p>Body</p>';
      component.links = [{ url: 'https://example.test' }];
      component.attachments = [{ name: 'a.png' } as never];
      component.activeComponents.set('a-1', {
        instanceId: 'a-1',
        componentDef: injectable('callout'),
        componentRef: {} as never,
        data: {},
      } as never);

      component.resetEditor();

      expect(component.title).toBe('');
      expect(component.content).toBe('');
      expect(component.links).toEqual([]);
      expect(component.attachments).toEqual([]);
      expect(component.getActiveComponents()).toEqual([]);
    });

    it('notifies the form that it emptied', () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);

      component.resetEditor();

      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('post theme controls', () => {
    it('toggles the theme panel', () => {
      const before = component.isThemeConfigVisible;

      component.toggleThemeConfig();

      expect(component.isThemeConfigVisible).toBe(!before);
    });

    it('sets the post theme without touching the global one', () => {
      const themeService = TestBed.inject(ThemeService);
      const setTheme = jest.spyOn(themeService, 'setTheme');

      component.updatePostTheme('dark');

      expect(component.postTheme).toBe('dark');
      expect(setTheme).not.toHaveBeenCalled();
    });

    it('sets the post accent colour', () => {
      component.updatePostAccentColor('#123456');

      expect(component.postAccentColor).toBe('#123456');
    });
  });

  describe('getInjectedComponentsNew', () => {
    it('is empty for a document with no component nodes', () => {
      component.editor?.commands.setContent('<p>Just text</p>', {
        emitUpdate: false,
      });

      expect(component.getInjectedComponentsNew()).toEqual([]);
    });

    it('collects a component node inserted into the document', async () => {
      const def = component.getRegisteredComponents()[0];

      await component.onComponentSelected(def);
      const found = component.getInjectedComponentsNew();

      expect(found.length).toBeGreaterThan(0);
      // Positions are assigned in document order, starting at zero.
      expect(found[0].position).toBe(0);
    });
  });

  describe('base64url component metadata', () => {
    const encode = (c: ComposeComponent, v: string) =>
      (
        c as unknown as { base64UrlEncodeUtf8(s: string): string }
      ).base64UrlEncodeUtf8(v);
    const decode = (c: ComposeComponent, v: string) =>
      (
        c as unknown as { base64UrlDecodeUtf8(s: string): string }
      ).base64UrlDecodeUtf8(v);

    it('round-trips plain text', () => {
      expect(decode(component, encode(component, 'hello world'))).toBe(
        'hello world'
      );
    });

    it('round-trips multi-byte characters', () => {
      const value = 'café — 日本語 — 🦝';

      expect(decode(component, encode(component, value))).toBe(value);
    });

    it('emits url-safe output with no padding', () => {
      // A payload chosen to produce + / and = under standard base64.
      const encoded = encode(component, '\u00ff\u00fe\u00fd');

      expect(encoded).not.toMatch(/[+/=]/);
    });

    it('round-trips a component data payload through the meta attribute', () => {
      const strip = (c: ComposeComponent, html: string) =>
        (
          c as unknown as {
            stripInjectedComponentsMeta(h: string): {
              html: string;
              injectedComponents?: unknown[];
            };
          }
        ).stripInjectedComponentsMeta(html);
      const add = (c: ComposeComponent, html: string, comps: unknown[]) =>
        (
          c as unknown as {
            addInjectedComponentsMeta(h: string, comps: unknown[]): string;
          }
        ).addInjectedComponentsMeta(html, comps);

      const html =
        '<div data-angular-component data-instance-id="a-1" data-component-id="callout"></div>';
      const withMeta = add(component, html, [
        { instanceId: 'a-1', data: { title: 'Kept' } },
      ]);
      expect(withMeta).toContain('data-component-data-base64');

      const result = strip(component, withMeta);

      expect(result.injectedComponents).toEqual([
        { instanceId: 'a-1', componentId: 'callout', data: { title: 'Kept' } },
      ]);
      // The attribute is removed once read, so it never round-trips twice.
      expect(result.html).not.toContain('data-component-data-base64');
    });

    it('returns the content untouched when there are no components to stamp', () => {
      const add = (c: ComposeComponent, html: string, comps: unknown[]) =>
        (
          c as unknown as {
            addInjectedComponentsMeta(h: string, comps: unknown[]): string;
          }
        ).addInjectedComponentsMeta(html, comps);

      expect(add(component, '<p>Body</p>', [])).toBe('<p>Body</p>');
    });

    it('skips a placeholder whose payload will not decode', () => {
      const strip = (c: ComposeComponent, html: string) =>
        (
          c as unknown as {
            stripInjectedComponentsMeta(h: string): {
              injectedComponents?: unknown[];
            };
          }
        ).stripInjectedComponentsMeta(html);

      const result = strip(
        component,
        '<div data-angular-component data-instance-id="a-1" data-component-id="callout" data-component-data-base64="!!!not-base64!!!"></div>'
      );

      expect(result.injectedComponents).toBeUndefined();
    });
  });
});
