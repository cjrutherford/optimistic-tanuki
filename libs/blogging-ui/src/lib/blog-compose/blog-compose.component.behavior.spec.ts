import { ChangeDetectorRef, ElementRef, ViewContainerRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ThemeColors, ThemeService } from '@optimistic-tanuki/theme-lib';
import { ImageUploadService } from '@optimistic-tanuki/compose-lib';
import { of } from 'rxjs';

import { BlogComposeComponent } from './blog-compose.component';
import { ComponentInjectionService } from './services/component-injection.service';
import {
  InjectableComponent,
  InjectedComponentInstance,
} from './interfaces/component-injection.interface';

// The editor is constructed inside ngAfterViewInit; the factory lets each test
// hand back its own editor double and inspect the config it was built with.
const mockEditorConfigs: Record<string, unknown>[] = [];
let mockEditorFactory: () => unknown = () => ({});

jest.mock('@tiptap/core', () => ({
  Editor: jest.fn().mockImplementation((config: Record<string, unknown>) => {
    mockEditorConfigs.push(config);
    return mockEditorFactory();
  }),
}));

jest.mock('ngx-tiptap', () => ({ TiptapEditorDirective: class {} }));
jest.mock('@tiptap/starter-kit', () => ({}));
jest.mock('@tiptap/extension-subscript', () => ({}));
jest.mock('@tiptap/extension-superscript', () => ({}));
jest.mock('@tiptap/extension-underline', () => ({}));
jest.mock('@tiptap/extension-text-align', () => ({ configure: () => ({}) }));
jest.mock('@tiptap/extension-table', () => ({
  Table: { configure: () => ({}) },
}));
jest.mock('@tiptap/extension-table-row', () => ({}));
jest.mock('@tiptap/extension-table-header', () => ({}));
jest.mock('@tiptap/extension-table-cell', () => ({}));
jest.mock('./extensions/resizable-image.extension', () => ({
  ResizableImage: {},
}));

const mockNodeConfigure = jest.fn();
jest.mock('./extensions/blog-compose-component.extension', () => ({
  BlogComposeComponentNode: {
    configure: (options: Record<string, unknown>) => {
      mockNodeConfigure(options);
      return {};
    },
  },
}));

jest.mock('@optimistic-tanuki/compose-lib', () => ({
  ComponentInjection: { configure: jest.fn().mockReturnValue({}) },
  ImageUploadService: class ImageUploadServiceStub {
    uploadFile = jest.fn();
  },
}));

interface ChainMock {
  focus: jest.Mock;
  insertContentAt: jest.Mock;
  setImage: jest.Mock;
  run: jest.Mock;
}

interface CommandsMock {
  setContent: jest.Mock;
  insertComponent: jest.Mock;
  insertAngularComponent: jest.Mock;
  updateAngularComponent: jest.Mock;
  removeAngularComponent: jest.Mock;
  removeComponent: jest.Mock;
}

interface EditorMock {
  commands: CommandsMock;
  chain: jest.Mock;
  chainApi: ChainMock;
  on: jest.Mock;
  destroy: jest.Mock;
  view: { dom: HTMLElement };
  state: { doc: { descendants: jest.Mock }; selection: { to: number } | null };
  getHTML: jest.Mock;
  setEditable: jest.Mock;
}

interface InjectionServiceMock {
  setViewContainer: jest.Mock;
  setWrapperCallbacks: jest.Mock;
  registerComponent: jest.Mock;
  unregisterComponent: jest.Mock;
  getRegisteredComponents: jest.Mock;
  getComponentsByCategory: jest.Mock;
  getInstance: jest.Mock;
  injectComponent: jest.Mock;
  renderComponentInto: jest.Mock;
  removeComponent: jest.Mock;
  moveComponent: jest.Mock;
  updateComponent: jest.Mock;
  getActiveComponents: jest.Mock;
}

interface UploadServiceMock {
  uploadFile: jest.Mock;
}

function createEditorMock(dom: HTMLElement): EditorMock {
  const chainApi = {} as ChainMock;
  chainApi.focus = jest.fn(() => chainApi);
  chainApi.insertContentAt = jest.fn(() => chainApi);
  chainApi.setImage = jest.fn(() => chainApi);
  chainApi.run = jest.fn();

  return {
    commands: {
      setContent: jest.fn(),
      insertComponent: jest.fn(),
      insertAngularComponent: jest.fn(),
      updateAngularComponent: jest.fn(),
      removeAngularComponent: jest.fn(),
      removeComponent: jest.fn(),
    },
    chain: jest.fn(() => chainApi),
    chainApi,
    on: jest.fn(),
    destroy: jest.fn(),
    view: { dom },
    state: { doc: { descendants: jest.fn() }, selection: { to: 7 } },
    getHTML: jest.fn().mockReturnValue('<p>editor html</p>'),
    setEditable: jest.fn(),
  };
}

function createInjectionServiceMock(): InjectionServiceMock {
  return {
    setViewContainer: jest.fn(),
    setWrapperCallbacks: jest.fn(),
    registerComponent: jest.fn(),
    unregisterComponent: jest.fn(),
    getRegisteredComponents: jest.fn().mockReturnValue([]),
    getComponentsByCategory: jest.fn().mockReturnValue([]),
    getInstance: jest.fn(),
    injectComponent: jest.fn(),
    renderComponentInto: jest.fn(),
    removeComponent: jest.fn(),
    moveComponent: jest.fn(),
    updateComponent: jest.fn(),
    getActiveComponents: jest.fn().mockReturnValue([]),
  };
}

const themeColors: ThemeColors = {
  background: '#ffffff',
  foreground: '#111111',
  accent: '#5969c3',
  complementary: '#59c360',
  tertiary: '#7e57c2',
  success: '#4caf50',
  danger: '#f44336',
  warning: '#ff9800',
  accentGradients: { light: 'accent-light', dark: 'accent-dark' },
  complementaryGradients: { light: 'comp-light', dark: 'comp-dark' },
  complementaryShades: [
    ['#eeeeee', '#e0e0e0'],
    ['#dddddd', '#d0d0d0'],
    ['#cccccc', '#c0c0c0'],
  ],
} as unknown as ThemeColors;

function makeInstance(
  instanceId: string,
  componentId: string,
  data: Record<string, unknown> = {}
): InjectedComponentInstance {
  return {
    instanceId,
    componentDef: {
      id: componentId,
      name: componentId,
      component: class {},
      properties: [
        { key: 'title', type: 'string', label: 'Title' },
      ] as InjectableComponent['properties'],
    },
    componentRef: {} as InjectedComponentInstance['componentRef'],
    data,
  };
}

describe('BlogComposeComponent (behaviour)', () => {
  let component: BlogComposeComponent;
  let injection: InjectionServiceMock;
  let upload: UploadServiceMock;
  let cdr: { detectChanges: jest.Mock };
  let editorDom: HTMLDivElement;
  let editor: EditorMock;

  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    mockEditorConfigs.length = 0;
    mockNodeConfigure.mockClear();

    injection = createInjectionServiceMock();
    upload = { uploadFile: jest.fn() };
    cdr = { detectChanges: jest.fn() };
    editorDom = document.createElement('div');
    Object.defineProperty(editorDom, 'clientWidth', { value: 800 });
    editor = createEditorMock(editorDom);
    mockEditorFactory = () => editor;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ThemeService,
          useValue: {
            themeColors$: of(themeColors),
            getTheme: jest.fn().mockReturnValue('light'),
          },
        },
        { provide: ComponentInjectionService, useValue: injection },
        { provide: ImageUploadService, useValue: upload },
        { provide: ChangeDetectorRef, useValue: cdr },
        {
          provide: ElementRef,
          useValue: new ElementRef(document.createElement('div')),
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new BlogComposeComponent());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** Runs ngAfterViewInit and flushes the microtask it defers work onto. */
  async function initView(): Promise<void> {
    component.componentContainer = {} as ViewContainerRef;
    component.ngAfterViewInit();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  describe('ngAfterViewInit', () => {
    it('wires the injection service to the view container and builds the editor', async () => {
      await initView();

      expect(injection.setViewContainer).toHaveBeenCalledWith(
        component.componentContainer
      );
      expect(injection.registerComponent).toHaveBeenCalled();
      expect(injection.getRegisteredComponents).toHaveBeenCalled();
      expect(component.editor).toBe(
        editor as unknown as typeof component.editor
      );
      expect(cdr.detectChanges).toHaveBeenCalled();
    });

    it('registers every catalogue component exactly once per id', async () => {
      await initView();

      const ids = injection.registerComponent.mock.calls.map(
        (call) => (call[0] as InjectableComponent).id
      );
      expect(ids).toEqual(
        expect.arrayContaining(['callout-box', 'hero', 'form-select'])
      );
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('routes wrapper callbacks back into the component handlers', async () => {
      await initView();

      const callbacks = injection.setWrapperCallbacks.mock
        .calls[0][0] as Record<string, (arg: unknown) => void>;
      const instance = makeInstance('i-1', 'callout-box');
      injection.getActiveComponents.mockReturnValue([
        instance,
        makeInstance('i-2', 'hero'),
      ]);

      callbacks['onEdit'](instance);
      expect(component.isPropertyEditorVisible).toBe(true);

      callbacks['onSelection'](instance);
      expect(component.selectedComponentInstance).toBe(instance);

      callbacks['onMoveDown'](instance);
      expect(injection.moveComponent).toHaveBeenCalledWith('i-1', 1);

      callbacks['onDuplicate'](instance);
      expect(injection.injectComponent).toHaveBeenCalledWith('callout-box', {});

      callbacks['onConfig'](instance);
      expect(component.selectedComponentInstance).toBe(instance);

      callbacks['onPropertiesChanged']({ instance, data: { title: 'x' } });
      expect(injection.updateComponent).toHaveBeenCalledWith('i-1', {
        title: 'x',
      });

      callbacks['onDelete'](instance);
      expect(injection.removeComponent).toHaveBeenCalledWith('i-1');
    });

    it('delegates the node extension renderer to the injection service', async () => {
      await initView();

      const options = mockNodeConfigure.mock.calls[0][0] as {
        renderer: (
          componentId: string,
          instanceId: string,
          data: Record<string, unknown>,
          element: HTMLElement
        ) => unknown;
        disableDefaultControls: boolean;
      };
      const target = document.createElement('div');
      options.renderer('hero', 'i-9', { a: 1 }, target);

      expect(options.disableDefaultControls).toBe(true);
      expect(injection.renderComponentInto).toHaveBeenCalledWith(
        'hero',
        'i-9',
        { a: 1 },
        target
      );
    });

    it('flushes content queued by writeValue before the editor existed', async () => {
      component.writeValue({ title: 'Queued', content: '<p>queued</p>' });
      expect(editor.commands.setContent).not.toHaveBeenCalled();

      await initView();

      expect(editor.commands.setContent).toHaveBeenCalledWith('<p>queued</p>');
    });

    it('opens the context menu at the pointer position on contextmenu', async () => {
      await initView();

      editorDom.dispatchEvent(
        new MouseEvent('contextmenu', {
          clientX: 42,
          clientY: 84,
          cancelable: true,
        })
      );

      expect(component.isContextMenuVisible).toBe(true);
      expect(component.contextMenuX).toBe(42);
      expect(component.contextMenuY).toBe(84);
    });

    it('sanitizes editor html and notifies the form control on update', async () => {
      await initView();
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      editor.getHTML.mockReturnValue('<p>safe</p><script>evil()</script>');

      const updateHandler = editor.on.mock.calls.find(
        (call) => call[0] === 'update'
      )?.[1] as () => void;
      updateHandler();

      expect(component.content).toBe('<p>safe</p>');
      expect(onChange).toHaveBeenCalled();
    });

    it('reconstructs placeholders that have no live instance yet', async () => {
      editorDom.innerHTML = `
        <span data-angular-component data-instance-id="p1" data-component-id="hero" data-component-data='{"title":"T"}'></span>
        <span data-angular-component data-instance-id="p2" data-component-id="hero" data-component-data='{oops'></span>
        <span data-angular-component data-component-id="hero"></span>
        <span data-angular-component data-instance-id="p4" data-component-id="hero"></span>
      `;
      injection.getInstance.mockImplementation((id: string) =>
        id === 'p4' ? makeInstance('p4', 'hero') : undefined
      );

      await initView();

      const rendered = injection.renderComponentInto.mock.calls.map(
        (call) => [call[0], call[1], call[2]] as [string, string, unknown]
      );
      expect(rendered).toEqual([
        ['hero', 'p1', { title: 'T' }],
        ['hero', 'p2', {}],
      ]);
    });

    it('warns but keeps going when a placeholder cannot be reconstructed', async () => {
      editorDom.innerHTML = `<span data-angular-component data-instance-id="p1" data-component-id="hero"></span>`;
      injection.renderComponentInto.mockImplementation(() => {
        throw new Error('boom');
      });

      await initView();

      expect(console.warn).toHaveBeenCalledWith(
        '[BlogCompose] Failed to reconstruct component',
        'hero',
        'p1',
        expect.any(Error)
      );
    });
  });

  describe('registration delegation', () => {
    it('unregisters through the service and refreshes the local catalogue', () => {
      const remaining: InjectableComponent[] = [
        { id: 'hero', name: 'Hero', component: class {} },
      ];
      injection.getRegisteredComponents.mockReturnValue(remaining);

      component.unregisterComponent('callout-box');

      expect(injection.unregisterComponent).toHaveBeenCalledWith('callout-box');
      expect(component.registeredComponents).toBe(remaining);
    });

    it('reads components by category from the service', () => {
      const blogging: InjectableComponent[] = [
        { id: 'hero', name: 'Hero', component: class {} },
      ];
      injection.getComponentsByCategory.mockReturnValue(blogging);

      expect(component.getComponentsByCategory('Blogging')).toBe(blogging);
      expect(injection.getComponentsByCategory).toHaveBeenCalledWith(
        'Blogging'
      );
    });
  });

  describe('component wrapper handlers', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
    });

    it('opens the property editor with the definition properties on edit', () => {
      const instance = makeInstance('i-1', 'hero');

      component.onComponentEdit(instance);

      expect(component.selectedComponentInstance).toBe(instance);
      expect(component.selectedComponentProperties).toBe(
        instance.componentDef.properties
      );
      expect(component.isPropertyEditorVisible).toBe(true);
    });

    it('falls back to an empty property list when the definition has none', () => {
      const instance = makeInstance('i-1', 'hero');
      instance.componentDef.properties = undefined;

      component.onComponentEdit(instance);

      expect(component.selectedComponentProperties).toEqual([]);
    });

    it('closes the property editor when the selected component is deleted', () => {
      const instance = makeInstance('i-1', 'hero');
      component.onComponentEdit(instance);

      component.onComponentDelete(instance);

      expect(injection.removeComponent).toHaveBeenCalledWith('i-1');
      expect(editor.commands.removeAngularComponent).toHaveBeenCalledWith(
        'i-1'
      );
      expect(component.isPropertyEditorVisible).toBe(false);
      expect(component.selectedComponentInstance).toBeNull();
    });

    it('leaves the property editor open when another component is deleted', () => {
      const selected = makeInstance('i-1', 'hero');
      component.onComponentEdit(selected);

      component.onComponentDelete(makeInstance('i-2', 'hero'));

      expect(component.isPropertyEditorVisible).toBe(true);
      expect(component.selectedComponentInstance).toBe(selected);
    });

    it.each([
      ['moves up when not first', 1, 'onComponentMoveUp' as const, 0],
      ['moves down when not last', 0, 'onComponentMoveDown' as const, 1],
    ])('%s', (_label, index, method, expectedPosition) => {
      const instances = [
        makeInstance('a', 'hero'),
        makeInstance('b', 'hero'),
        makeInstance('c', 'hero'),
      ];
      injection.getActiveComponents.mockReturnValue(instances);

      component[method](instances[index]);

      expect(injection.moveComponent).toHaveBeenCalledWith(
        instances[index].instanceId,
        expectedPosition
      );
    });

    it.each([
      ['first component cannot move up', 0, 'onComponentMoveUp' as const],
      ['last component cannot move down', 1, 'onComponentMoveDown' as const],
    ])('%s', (_label, index, method) => {
      const instances = [makeInstance('a', 'hero'), makeInstance('b', 'hero')];
      injection.getActiveComponents.mockReturnValue(instances);

      component[method](instances[index]);

      expect(injection.moveComponent).not.toHaveBeenCalled();
    });

    it('does not move an unknown instance down', () => {
      injection.getActiveComponents.mockReturnValue([
        makeInstance('a', 'hero'),
      ]);

      component.onComponentMoveDown(makeInstance('zzz', 'hero'));

      expect(injection.moveComponent).not.toHaveBeenCalled();
    });

    it('duplicates a component without carrying the inner component reference', () => {
      const instance = makeInstance('i-1', 'hero', {
        title: 'Copy me',
        _innerComponentRef: { nope: true },
      });

      component.onComponentDuplicate(instance);

      expect(injection.injectComponent).toHaveBeenCalledWith('hero', {
        title: 'Copy me',
      });
    });

    it('treats a config request as an edit request', () => {
      const instance = makeInstance('i-1', 'hero');

      component.onComponentConfig(instance);

      expect(component.isPropertyEditorVisible).toBe(true);
      expect(component.selectedComponentInstance).toBe(instance);
    });

    it('pushes inline property edits to both the service and the editor node', () => {
      const onChange = jest.fn();
      component.registerOnChange(onChange);
      const instance = makeInstance('i-1', 'hero');

      component.onComponentPropertiesChanged({
        instance,
        data: { title: 'Fresh' },
      });

      expect(injection.updateComponent).toHaveBeenCalledWith('i-1', {
        title: 'Fresh',
      });
      expect(editor.commands.updateAngularComponent).toHaveBeenCalledWith({
        instanceId: 'i-1',
        data: { title: 'Fresh' },
      });
      expect(onChange).toHaveBeenCalled();
    });

    it('applies property editor updates to the selected instance only', () => {
      component.onPropertiesUpdated({ title: 'ignored' });
      expect(injection.updateComponent).not.toHaveBeenCalled();

      component.onComponentEdit(makeInstance('i-1', 'hero'));
      component.onPropertiesUpdated({ title: 'applied' });

      expect(injection.updateComponent).toHaveBeenCalledWith('i-1', {
        title: 'applied',
      });
      expect(editor.commands.updateAngularComponent).toHaveBeenCalledWith({
        instanceId: 'i-1',
        data: { title: 'applied' },
      });
    });

    it('clears editor state when the property editor is closed', () => {
      component.onComponentEdit(makeInstance('i-1', 'hero'));

      component.closePropertyEditor();

      expect(component.isPropertyEditorVisible).toBe(false);
      expect(component.selectedComponentInstance).toBeNull();
      expect(component.selectedComponentProperties).toEqual([]);
    });

    it('hides the context menu and clears the selection on document click', () => {
      component.isContextMenuVisible = true;
      component.selectedComponentInstance = makeInstance('i-1', 'hero');

      component.onDocumentClick();

      expect(component.isContextMenuVisible).toBe(false);
      expect(component.selectedComponentInstance).toBeNull();
    });
  });

  describe('component API delegation', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
    });

    it('updates a component in the service and the editor node', () => {
      component.updateComponent('i-1', { title: 'a' });

      expect(injection.updateComponent).toHaveBeenCalledWith('i-1', {
        title: 'a',
      });
      expect(editor.commands.updateAngularComponent).toHaveBeenCalledWith({
        instanceId: 'i-1',
        data: { title: 'a' },
      });
    });

    it('reads a single instance from the service', () => {
      const instance = makeInstance('i-1', 'hero');
      injection.getInstance.mockReturnValue(instance);

      expect(component.getComponent('i-1')).toBe(instance);
    });

    it('removes a component from the service and the editor', () => {
      component.removeComponent('i-1');

      expect(injection.removeComponent).toHaveBeenCalledWith('i-1');
      expect(editor.commands.removeComponent).toHaveBeenCalledWith('i-1');
    });

    it('moves a component through the service', () => {
      component.moveComponent('i-1', 3);

      expect(injection.moveComponent).toHaveBeenCalledWith('i-1', 3);
    });

    it('injects by id through the selection flow', async () => {
      injection.getRegisteredComponents.mockReturnValue([]);
      injection.getInstance.mockReturnValue(undefined);

      const instance = await component.injectComponent('hero', { a: 1 });

      expect(editor.commands.insertComponent).toHaveBeenCalledWith(
        expect.objectContaining({ componentType: 'hero', data: { a: 1 } })
      );
      expect(instance.componentDef.id).toBe('hero');
    });
  });

  describe('getInjectedComponentsNew', () => {
    it('returns nothing when the editor has not been created', () => {
      expect(component.getInjectedComponentsNew()).toEqual([]);
    });

    it('collects every component node type in document order', () => {
      component.editor = editor as unknown as typeof component.editor;
      editor.state.doc.descendants.mockImplementation(
        (visit: (node: unknown) => void) => {
          visit({
            type: { name: 'blogComposeComponent' },
            attrs: { instanceId: 'a', componentId: 'hero', data: { x: 1 } },
          });
          visit({ type: { name: 'paragraph' }, attrs: {} });
          visit({
            type: { name: 'angularComponent' },
            attrs: { instanceId: 'b', componentId: 'callout-box' },
          });
        }
      );

      expect(component.getInjectedComponentsNew()).toEqual([
        {
          instanceId: 'a',
          componentType: 'hero',
          componentData: { x: 1 },
          position: 0,
        },
        {
          instanceId: 'b',
          componentType: 'callout-box',
          componentData: {},
          position: 1,
        },
      ]);
    });
  });

  describe('toolbar and selector visibility', () => {
    it('toggles the component selector from the toolbar', () => {
      component.onToolbarComponentsClick();
      expect(component.isComponentSelectorVisible).toBe(true);

      component.onToolbarComponentsClick();
      expect(component.isComponentSelectorVisible).toBe(false);
    });

    it('clicks the hidden file input when the toolbar asks for an image', () => {
      const input = document.createElement('input');
      input.id = 'imageInput';
      const clickSpy = jest
        .spyOn(input, 'click')
        .mockImplementation(() => undefined);
      document.body.appendChild(input);

      component.onToolbarImageUploadClick();

      expect(clickSpy).toHaveBeenCalled();
      input.remove();
    });

    it('is a no-op when the file input is absent', () => {
      expect(() => component.onToolbarImageUploadClick()).not.toThrow();
    });

    it('shows and hides the component selector', () => {
      component.showComponentSelector();
      expect(component.isComponentSelectorVisible).toBe(true);

      component.hideComponentSelector();
      expect(component.isComponentSelectorVisible).toBe(false);
    });

    it('toggles the theme config panel and records post theme choices', () => {
      component.toggleThemeConfig();
      expect(component.isThemeConfigVisible).toBe(true);

      component.updatePostTheme('dark');
      component.updatePostAccentColor('#abcdef');

      expect(component.postTheme).toBe('dark');
      expect(component.postAccentColor).toBe('#abcdef');
    });
  });

  describe('onComponentSelected', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
      component.isComponentSelectorVisible = true;
    });

    it('merges registered defaults over the passed data and inserts into both extensions', async () => {
      const registered: InjectableComponent = {
        id: 'hero',
        name: 'Hero',
        component: class {},
        data: { title: 'Registered' },
      };
      injection.getRegisteredComponents.mockReturnValue([registered]);
      const resolved = makeInstance('hero-x', 'hero');
      injection.getInstance.mockReturnValue(resolved);

      const result = await component.onComponentSelected({
        id: 'hero',
        name: 'Hero',
        component: class {},
        data: { title: 'Passed', extra: true },
      });

      const inserted = editor.commands.insertComponent.mock.calls[0][0] as {
        instanceId: string;
        componentType: string;
        data: Record<string, unknown>;
      };
      expect(inserted.componentType).toBe('hero');
      expect(inserted.data).toEqual({ title: 'Registered', extra: true });
      expect(editor.commands.insertAngularComponent).toHaveBeenCalledWith(
        expect.objectContaining({
          componentId: 'hero',
          instanceId: inserted.instanceId,
          componentDef: registered,
        })
      );
      expect(editor.chainApi.insertContentAt).toHaveBeenCalledWith(7, {
        type: 'paragraph',
      });
      expect(component.isComponentSelectorVisible).toBe(false);
      expect(result).toBe(resolved);
    });

    it('resolves a placeholder instance when the service has not registered one', async () => {
      injection.getRegisteredComponents.mockReturnValue([]);
      injection.getInstance.mockReturnValue(undefined);
      editor.state.selection = null;

      const unregistered: InjectableComponent = {
        id: 'ad-hoc',
        name: 'Ad hoc',
        component: class {},
      };
      const result = await component.onComponentSelected(unregistered);

      expect(result.componentDef).toBe(unregistered);
      expect(result.instanceId).toContain('ad-hoc-');
      expect(editor.chainApi.insertContentAt).not.toHaveBeenCalled();
    });
  });

  describe('drag and drop', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
      jest.spyOn(window, 'alert').mockImplementation(() => undefined);
    });

    function dragEvent(types: string[], files: File[] = []): DragEvent {
      return {
        preventDefault: jest.fn(),
        dataTransfer: { types, files },
      } as unknown as DragEvent;
    }

    it.each([['handleDragEnter' as const], ['handleDragOver' as const]])(
      '%s only highlights when files are dragged',
      (method) => {
        component[method](dragEvent(['text/plain']));
        expect(component.isDragOver).toBe(false);

        component[method](dragEvent(['Files']));
        expect(component.isDragOver).toBe(true);
      }
    );

    it('clears the highlight on drag leave', () => {
      component.isDragOver = true;

      component.handleDragLeave(dragEvent(['Files']));

      expect(component.isDragOver).toBe(false);
    });

    it('ignores a drop with no files', async () => {
      await component.handleDrop(dragEvent(['Files']));

      expect(upload.uploadFile).not.toHaveBeenCalled();
      expect(component.isDragOver).toBe(false);
    });

    it('refuses to upload when no profile id is set', async () => {
      const file = new File(['x'], 'a.png', { type: 'image/png' });

      await component.handleDrop(dragEvent(['Files'], [file]));

      expect(window.alert).toHaveBeenCalledWith(
        'Unable to upload image: User profile not found'
      );
      expect(upload.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a drop that contains no images', async () => {
      component.profileId = 'profile-1';
      const file = new File(['x'], 'a.txt', { type: 'text/plain' });

      await component.handleDrop(dragEvent(['Files'], [file]));

      expect(window.alert).toHaveBeenCalledWith('Please drop image files only');
      expect(upload.uploadFile).not.toHaveBeenCalled();
    });

    it('uploads each dropped image and inserts it at 95% of the editor width', async () => {
      component.profileId = 'profile-1';
      upload.uploadFile.mockResolvedValue('https://cdn/img.png');
      const file = new File(['x'], 'a.png', { type: 'image/png' });

      await component.handleDrop(dragEvent(['Files'], [file]));

      expect(upload.uploadFile).toHaveBeenCalledWith(
        file,
        'profile-1',
        expect.stringContaining('blog-drag-drop-')
      );
      expect(editor.chainApi.setImage).toHaveBeenCalledWith({
        src: 'https://cdn/img.png',
        width: 760,
      });
    });

    it('reports an upload failure for the offending file', async () => {
      component.profileId = 'profile-1';
      upload.uploadFile.mockRejectedValue(new Error('nope'));
      const file = new File(['x'], 'broken.png', { type: 'image/png' });

      await component.handleDrop(dragEvent(['Files'], [file]));

      expect(window.alert).toHaveBeenCalledWith(
        'Failed to upload broken.png. Please try again.'
      );
    });
  });

  describe('onFileSelected', () => {
    let originalImage: typeof Image;

    class FakeImage {
      onload: (() => void) | null = null;
      private innerSrc = '';
      set src(value: string) {
        this.innerSrc = value;
        this.onload?.();
      }
      get src(): string {
        return this.innerSrc;
      }
    }

    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
      jest.spyOn(window, 'alert').mockImplementation(() => undefined);
      originalImage = globalThis.Image;
      globalThis.Image = FakeImage as unknown as typeof Image;
    });

    afterEach(() => {
      globalThis.Image = originalImage;
    });

    function fileEvent(files: File[]): Event {
      return {
        target: { files, value: 'C:/fake/a.png' },
      } as unknown as Event;
    }

    it('does nothing when no file was chosen', async () => {
      await component.onFileSelected(fileEvent([]));

      expect(upload.uploadFile).not.toHaveBeenCalled();
    });

    it('clears the input and warns when there is no profile id', async () => {
      const event = fileEvent([
        new File(['x'], 'a.png', { type: 'image/png' }),
      ]);

      await component.onFileSelected(event);

      expect(window.alert).toHaveBeenCalledWith(
        'Unable to upload image: User profile not found'
      );
      expect((event.target as HTMLInputElement).value).toBe('');
    });

    it('uploads the file and inserts the returned asset url', async () => {
      component.profileId = 'profile-1';
      upload.uploadFile.mockResolvedValue('https://cdn/asset.png');
      const file = new File(['x'], 'a.png', { type: 'image/png' });
      const event = fileEvent([file]);

      await component.onFileSelected(event);

      expect(upload.uploadFile).toHaveBeenCalledWith(
        file,
        'profile-1',
        expect.stringContaining('blog-image-')
      );
      expect(editor.chainApi.setImage).toHaveBeenCalledWith({
        src: 'https://cdn/asset.png',
        width: 760,
      });
      expect((event.target as HTMLInputElement).value).toBe('');
    });

    it('alerts and still clears the input when the upload fails', async () => {
      component.profileId = 'profile-1';
      upload.uploadFile.mockRejectedValue(new Error('nope'));
      const event = fileEvent([
        new File(['x'], 'a.png', { type: 'image/png' }),
      ]);

      await component.onFileSelected(event);

      expect(window.alert).toHaveBeenCalledWith(
        'Failed to upload image. Please try again.'
      );
      expect((event.target as HTMLInputElement).value).toBe('');
    });
  });

  describe('inline component interactions', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
    });

    it.each([
      ['onInlineComponentClick' as const],
      ['onInlineComponentEdit' as const],
    ])('%s opens the property editor for a known instance', (method) => {
      const instance = makeInstance('i-1', 'hero');
      injection.getInstance.mockReturnValue(instance);

      if (method === 'onInlineComponentClick') {
        component.onInlineComponentClick('hero', 'i-1');
      } else {
        component.onInlineComponentEdit('i-1');
      }

      expect(component.selectedComponentInstance).toBe(instance);
      expect(component.isPropertyEditorVisible).toBe(true);
    });

    it('ignores an inline click for an unknown instance', () => {
      injection.getInstance.mockReturnValue(undefined);

      component.onInlineComponentClick('hero', 'missing');

      expect(component.isPropertyEditorVisible).toBe(false);
    });

    it('deletes inline components from the editor and the service', () => {
      component.onInlineComponentDelete('i-1');

      expect(editor.commands.removeAngularComponent).toHaveBeenCalledWith(
        'i-1'
      );
      expect(injection.removeComponent).toHaveBeenCalledWith('i-1');
    });
  });

  describe('serialization round trip', () => {
    beforeEach(() => {
      component.editor = editor as unknown as typeof component.editor;
    });

    it('embeds injected component state in the submitted content and reads it back', () => {
      const cyclic: Record<string, unknown> = { label: 'loop' };
      cyclic['self'] = cyclic;
      const instance = makeInstance('i-1', 'hero', {
        title: 'Hello',
        tags: ['a', 'b'],
        componentRef: { drop: 'me' },
        viewContainerRef: { drop: 'me' },
        cyclic,
      });
      injection.getActiveComponents.mockReturnValue([instance]);
      editor.getHTML.mockReturnValue('<p>body</p>');
      editor.state.doc.descendants.mockImplementation(() => undefined);
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);

      component.onPostSubmit();

      const payload = emitted.mock.calls[0][0] as {
        content: string;
        injectedComponents: InjectedComponentInstance[];
        injectedComponentsNew: unknown[];
      };
      expect(payload.content).toContain('data-ot-injected-components');
      expect(payload.injectedComponents).toEqual([instance]);
      expect(payload.injectedComponentsNew).toEqual([]);

      // Feed the stored html back in the way the DB round trip would.
      component.editor = undefined as unknown as typeof component.editor;
      component.writeValue({ title: 'Hello', content: payload.content });

      expect(component.content).toBe('<p>body</p>');
      const restored = (
        component as unknown as { pendingInjectedComponents: unknown[] }
      ).pendingInjectedComponents;
      expect(restored).toEqual([
        {
          instanceId: 'i-1',
          componentDef: { id: 'hero' },
          data: {
            title: 'Hello',
            tags: ['a', 'b'],
            cyclic: { label: 'loop' },
          },
        },
      ]);
    });

    it('replaces stale meta rather than appending a second marker', () => {
      injection.getActiveComponents.mockReturnValue([
        makeInstance('i-1', 'hero', { title: 'One' }),
      ]);
      editor.getHTML.mockReturnValue('<p>body</p>');
      editor.state.doc.descendants.mockImplementation(() => undefined);
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);

      component.onPostSubmit();
      const first = (emitted.mock.calls[0][0] as { content: string }).content;

      editor.getHTML.mockReturnValue(first);
      component.onPostSubmit();
      const second = (emitted.mock.calls[1][0] as { content: string }).content;

      expect(second.match(/data-ot-injected-components/g)).toHaveLength(1);
    });

    it('strips stale meta when there are no injected components left', () => {
      injection.getActiveComponents.mockReturnValue([
        makeInstance('i-1', 'hero', { title: 'One' }),
      ]);
      editor.getHTML.mockReturnValue('<p>body</p>');
      editor.state.doc.descendants.mockImplementation(() => undefined);
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);
      component.onPostSubmit();
      const withMeta = (emitted.mock.calls[0][0] as { content: string })
        .content;

      injection.getActiveComponents.mockReturnValue([]);
      editor.getHTML.mockReturnValue(withMeta);
      component.onPostSubmit();

      const cleaned = (emitted.mock.calls[1][0] as { content: string }).content;
      expect(cleaned).toBe('<p>body</p>');
    });

    it('ignores malformed meta markers', () => {
      component.editor = undefined as unknown as typeof component.editor;

      component.writeValue({
        content:
          '<p>body</p><span data-ot-injected-components="!!!not-base64!!!"></span>',
      });

      expect(component.content).toBe('<p>body</p>');
      expect(
        (component as unknown as { pendingInjectedComponents: unknown })
          .pendingInjectedComponents
      ).toBeNull();
    });

    it('falls back to the tracked content when the editor is gone', () => {
      component.editor = undefined as unknown as typeof component.editor;
      component.content = '<p>tracked</p>';
      const emitted = jest.fn();
      component.postSubmitted.subscribe(emitted);

      component.onPostSubmit();

      expect((emitted.mock.calls[0][0] as { content: string }).content).toBe(
        '<p>tracked</p>'
      );
    });
  });

  describe('ControlValueAccessor', () => {
    it('ignores non-object values', () => {
      component.writeValue('nope');

      expect(component.title).toBe('');
      expect(component.content).toBe('');
    });

    it('applies the stored theme config', () => {
      component.writeValue({
        content: '',
        themeConfig: { theme: 'dark', accentColor: '#123456' },
      });

      expect(component.postTheme).toBe('dark');
      expect(component.postAccentColor).toBe('#123456');
    });

    it('falls back to the default theme when none is stored', () => {
      component.postTheme = 'dark';
      component.postAccentColor = '#000000';

      component.writeValue({ content: '' });

      expect(component.postTheme).toBe('light');
      expect(component.postAccentColor).toBe('#3f51b5');
    });

    it('defaults collections when the stored value omits them', () => {
      component.writeValue({});

      expect(component.content).toBe('');
      expect(component.title).toBe('');
      expect(component.links).toEqual([]);
      expect(component.attachments).toEqual([]);
    });

    it('restores injected component data straight away when the editor exists', async () => {
      component.editor = editor as unknown as typeof component.editor;
      const placeholder = document.createElement('span');
      placeholder.setAttribute('data-angular-component', '');
      placeholder.setAttribute('data-instance-id', 'i-1');
      placeholder.setAttribute('data-component-id', 'hero');
      editorDom.appendChild(placeholder);
      injection.getInstance.mockReturnValue(undefined);

      component.writeValue({
        content: '<p>body</p>',
        injectedComponents: [
          { instanceId: 'i-1', data: { title: 'Restored' } },
          { instanceId: null },
          null,
        ],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(editor.commands.setContent).toHaveBeenCalledWith('<p>body</p>');
      expect(injection.renderComponentInto).toHaveBeenCalledWith(
        'hero',
        'i-1',
        { title: 'Restored' },
        placeholder
      );
      expect(editor.commands.updateAngularComponent).toHaveBeenCalledWith({
        instanceId: 'i-1',
        data: { title: 'Restored' },
      });
    });

    it('updates an already-live instance instead of re-rendering it', async () => {
      component.editor = editor as unknown as typeof component.editor;
      injection.getInstance.mockReturnValue(makeInstance('i-1', 'hero'));

      component.writeValue({
        content: '<p>body</p>',
        injectedComponents: [{ instanceId: 'i-1', data: { title: 'Live' } }],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(injection.renderComponentInto).not.toHaveBeenCalled();
      expect(injection.updateComponent).toHaveBeenCalledWith('i-1', {
        title: 'Live',
      });
    });

    it('warns when restoring a component throws', async () => {
      component.editor = editor as unknown as typeof component.editor;
      injection.getInstance.mockImplementation(() => {
        throw new Error('boom');
      });

      component.writeValue({
        content: '<p>body</p>',
        injectedComponents: [{ instanceId: 'i-1', data: { title: 'x' } }],
      });
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(console.warn).toHaveBeenCalledWith(
        '[BlogCompose] Failed to restore component data',
        'i-1',
        expect.any(Error)
      );
    });

    it('marks the control as touched through the registered callback', () => {
      const onTouched = jest.fn();
      component.registerOnTouched(onTouched);

      component.title = 'Anything';

      expect(onTouched).toHaveBeenCalled();
    });

    it('does not emit when the title is set to the same value', () => {
      component.title = 'Same';
      const onChange = jest.fn();
      component.registerOnChange(onChange);

      component.title = 'Same';

      expect(onChange).not.toHaveBeenCalled();
    });

    it('toggles editor editability with the disabled state', () => {
      component.setDisabledState(true);
      expect(editor.setEditable).not.toHaveBeenCalled();

      component.editor = editor as unknown as typeof component.editor;
      component.setDisabledState(true);
      expect(editor.setEditable).toHaveBeenCalledWith(false);

      component.setDisabledState(false);
      expect(editor.setEditable).toHaveBeenCalledWith(true);
    });
  });

  describe('theming', () => {
    it.each([
      ['light' as const, 'accent-light'],
      ['dark' as const, 'accent-dark'],
    ])('applies the %s border gradient', (theme, expectedGradient) => {
      component.theme = theme;

      component.applyTheme(themeColors);

      expect(component.borderGradient).toBe(expectedGradient);
      expect(component.borderColor).toBe('#c0c0c0');
      expect(component.background).toBe('#ffffff');
      expect(component.accent).toBe('#5969c3');
      expect(component.complement).toBe('#59c360');
      expect(component.backgroundGradient).toContain('radial-gradient');
      expect(component.transitionDuration).toBe('0.15s');
    });
  });

  describe('ngOnDestroy', () => {
    it('destroys the editor when one exists', () => {
      component.editor = editor as unknown as typeof component.editor;

      component.ngOnDestroy();

      expect(editor.destroy).toHaveBeenCalled();
    });

    it('is safe with no editor', () => {
      expect(() => component.ngOnDestroy()).not.toThrow();
    });
  });
});
