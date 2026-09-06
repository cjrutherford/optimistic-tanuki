import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input } from '@angular/core';

import { ComponentEditorWrapperComponent } from './component-editor-wrapper.component';
import {
  InjectedComponentInstance,
  InjectableComponent,
} from '../interfaces/component-injection.interface';

// Simple mock component for testing
@Component({
  // eslint-disable-next-line @angular-eslint/component-selector
  selector: 'mock-test-component',
  template: '<div class="test-component">{{ title }}</div>',
  standalone: true,
})
class MockTestComponent {
  @Input() title = 'Test Title';
  @Input() content = 'Test Content';
}

describe('ComponentEditorWrapperComponent', () => {
  let component: ComponentEditorWrapperComponent;
  let fixture: ComponentFixture<ComponentEditorWrapperComponent>;

  const mockComponentDef: InjectableComponent = {
    id: 'test-component',
    name: 'Test Component',
    description: 'A test component for unit testing',
    component: MockTestComponent,
    category: 'Test',
    icon: 'test_icon',
    data: {
      title: 'Default Title',
      content: 'Default Content',
    },
  };

  const mockComponentInstance: InjectedComponentInstance = {
    instanceId: 'test-instance-123',
    componentDef: mockComponentDef,
    componentRef: {
      instance: { title: 'Instance Title' },
      changeDetectorRef: { detectChanges: jest.fn() },
      destroy: jest.fn(),
    } as any,
    data: {
      title: 'Instance Title',
      content: 'Instance Content',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ComponentEditorWrapperComponent,
        FormsModule,
        NoopAnimationsModule,
        MockTestComponent,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentEditorWrapperComponent);
    component = fixture.componentInstance;
    component.componentInstance = mockComponentInstance;
    component.componentDef = mockComponentDef;
    component.componentData = { title: 'Test', content: 'Content' };
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show control bar on hover', () => {
    component.onMouseEnter();
    expect(component.isHovered).toBe(true);
  });

  it('should hide control bar on mouse leave', () => {
    component.onMouseEnter();
    component.onMouseLeave();
    expect(component.isHovered).toBe(false);
  });

  it('should emit selectionChanged on click', () => {
    const spy = jest.spyOn(component.selectionChanged, 'emit');
    // Create a proper mock event with stopPropagation and target.closest
    const event = {
      stopPropagation: jest.fn(),
      target: document.createElement('div'),
    } as unknown as MouseEvent;
    component.onClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should emit editRequested when edit button clicked', () => {
    // Note: The editRequested event is for the full property editor
    // The component now opens inline quick edit instead
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.onEditClick(event);
    expect(component.isEditing).toBe(true);
  });

  it('should emit deleteRequested when delete button clicked', () => {
    const spy = jest.spyOn(component.deleteRequested, 'emit');
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.onDeleteClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should emit duplicateRequested when duplicate button clicked', () => {
    const spy = jest.spyOn(component.duplicateRequested, 'emit');
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.onDuplicateClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should open quick edit mode', () => {
    expect(component.isEditing).toBe(false);
    const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
    component.onEditClick(event);
    expect(component.isEditing).toBe(true);
  });

  it('should close quick edit mode', () => {
    component.isEditing = true;
    component.closeQuickEdit();
    expect(component.isEditing).toBe(false);
  });

  it('should cancel quick edit and restore original data', () => {
    component.componentData = { title: 'Original' };
    component.editingData = { title: 'Modified' };
    component.isEditing = true;

    component.cancelQuickEdit();

    expect(component.isEditing).toBe(false);
    expect(component.editingData['title']).toBe('Original');
  });

  it('should emit propertiesChanged on save', () => {
    const spy = jest.spyOn(component.propertiesChanged, 'emit');
    component.editingData = { title: 'New Title' };
    component.isEditing = true;

    component.saveQuickEdit();

    expect(spy).toHaveBeenCalledWith({
      instance: mockComponentInstance,
      data: { title: 'New Title' },
    });
    expect(component.isEditing).toBe(false);
  });

  it('should format property values correctly', () => {
    component.componentData = {
      stringValue: 'test',
      boolTrue: true,
      boolFalse: false,
      longString:
        'This is a very long string that should be truncated for display purposes',
    };

    expect(component.formatPropertyValue('stringValue')).toBe('test');
    expect(component.formatPropertyValue('boolTrue')).toBe('Yes');
    expect(component.formatPropertyValue('boolFalse')).toBe('No');
    expect(component.formatPropertyValue('nonExistent')).toBe('-');
    expect(
      component.formatPropertyValue('longString').length
    ).toBeLessThanOrEqual(33); // 30 chars + '...'
  });

  it('should check for visible properties', () => {
    // This depends on COMPONENT_PROPERTY_DEFINITIONS having entries for test-component
    // Since we're using a mock component, hasVisibleProperties may return false
    const hasProps = component.hasVisibleProperties();
    expect(typeof hasProps).toBe('boolean');
  });

  it('should get editable properties', () => {
    // The editableProperties getter filters based on COMPONENT_PROPERTY_DEFINITIONS
    const props = component.editableProperties;
    expect(Array.isArray(props)).toBe(true);
  });

  describe('property definitions', () => {
    it('returns nothing when there is no component definition id', () => {
      component.componentDef = {
        id: '',
        name: '',
        component: MockTestComponent,
      };

      expect(component.editableProperties).toEqual([]);
      expect(component.getPreviewProperties()).toEqual([]);
      expect(component.hasVisibleProperties()).toBe(false);
    });

    it('prefers block definition fields over the legacy properties list', () => {
      component.componentDef = {
        ...mockComponentDef,
        properties: [{ key: 'legacy', type: 'string', label: 'Legacy' }],
        blockDefinition: {
          type: 'test-component',
          name: 'Test Component',
          fields: [
            { key: 'title', type: 'string', label: 'Title' },
            {
              key: 'emitted',
              type: 'string',
              label: 'Emitted',
              isOutput: true,
            },
          ],
        },
      };

      expect(component.editableProperties.map((p) => p.key)).toEqual(['title']);
    });

    it('limits the preview to four simple, populated properties', () => {
      component.componentDef = {
        ...mockComponentDef,
        properties: [
          { key: 'a', type: 'string', label: 'A' },
          { key: 'b', type: 'number', label: 'B' },
          { key: 'c', type: 'boolean', label: 'C' },
          { key: 'd', type: 'string', label: 'D' },
          { key: 'e', type: 'string', label: 'E' },
          { key: 'f', type: 'array', label: 'F' },
          { key: 'g', type: 'string', label: 'G' },
          { key: 'h', type: 'string', label: 'H', isOutput: true },
          { key: 'missing', type: 'string', label: 'Missing' },
        ],
      };
      component.componentData = {
        a: 'a',
        b: 1,
        c: false,
        d: 'd',
        e: 'e',
        f: [1],
        g: '',
        h: 'h',
      };

      expect(component.getPreviewProperties().map((p) => p.key)).toEqual([
        'a',
        'b',
        'c',
        'd',
      ]);
      expect(component.hasVisibleProperties()).toBe(true);
    });
  });

  describe('editing data initialization', () => {
    it('seeds JSON mirrors for array and object properties on init', () => {
      component.componentDef = {
        ...mockComponentDef,
        properties: [
          { key: 'items', type: 'array', label: 'Items' },
          { key: 'config', type: 'object', label: 'Config' },
          { key: 'empty', type: 'array', label: 'Empty' },
          { key: 'title', type: 'string', label: 'Title' },
        ],
      };
      component.componentData = {
        items: [1, 2],
        config: { a: 1 },
        title: 'Hi',
      };

      component.ngOnInit();

      expect(component.editingData['items_json']).toBe(
        JSON.stringify([1, 2], null, 2)
      );
      expect(component.editingData['config_json']).toBe(
        JSON.stringify({ a: 1 }, null, 2)
      );
      expect(component.editingData['empty_json']).toBe('');
      expect(component.editingData['title_json']).toBeUndefined();
    });
  });

  describe('placeholders', () => {
    it.each([
      ['string', 'Enter text...'],
      ['number', '0'],
      ['url', 'https://example.com'],
      ['boolean', ''],
    ] as const)('uses the %s fallback placeholder', (type, expected) => {
      expect(component.getPlaceholder({ key: 'k', type, label: 'K' })).toBe(
        expected
      );
    });

    it('prefers the declared default value', () => {
      expect(
        component.getPlaceholder({
          key: 'k',
          type: 'string',
          label: 'K',
          defaultValue: 42,
        })
      ).toBe('42');
    });

    it('builds JSON placeholders from defaults or generic examples', () => {
      expect(
        component.getArrayPlaceholder({
          key: 'k',
          type: 'array',
          label: 'K',
          defaultValue: ['x'],
        })
      ).toBe(JSON.stringify(['x'], null, 2));
      expect(
        component.getArrayPlaceholder({ key: 'k', type: 'array', label: 'K' })
      ).toBe(JSON.stringify(['item1', 'item2'], null, 2));
      expect(
        component.getObjectPlaceholder({
          key: 'k',
          type: 'object',
          label: 'K',
          defaultValue: { a: 1 },
        })
      ).toBe(JSON.stringify({ a: 1 }, null, 2));
      expect(
        component.getObjectPlaceholder({ key: 'k', type: 'object', label: 'K' })
      ).toBe(JSON.stringify({ key: 'value' }, null, 2));
    });
  });

  describe('JSON editing', () => {
    beforeEach(() => {
      component.editingData = {};
    });

    it('accepts a valid array', () => {
      component.updateArrayFromJson('items', '[1, 2]');

      expect(component.editingData['items']).toEqual([1, 2]);
    });

    it('rejects valid JSON that is not an array', () => {
      component.updateArrayFromJson('items', '{"a":1}');

      expect(component.editingData['items']).toBeUndefined();
    });

    it('warns and keeps the previous value for malformed array JSON', () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      component.updateArrayFromJson('items', '[1,');

      expect(component.editingData['items']).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('accepts a valid object', () => {
      component.updateObjectFromJson('config', '{"a":1}');

      expect(component.editingData['config']).toEqual({ a: 1 });
    });

    it('rejects a null literal', () => {
      component.updateObjectFromJson('config', 'null');

      expect(component.editingData['config']).toBeUndefined();
    });

    it('warns and keeps the previous value for malformed object JSON', () => {
      const warn = jest
        .spyOn(console, 'warn')
        .mockImplementation(() => undefined);

      component.updateObjectFromJson('config', '{oops');

      expect(component.editingData['config']).toBeUndefined();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('ngOnChanges', () => {
    function dataChange(previous: unknown, current: unknown) {
      return {
        componentData: {
          previousValue: previous,
          currentValue: current,
          firstChange: false,
          isFirstChange: () => false,
        },
      };
    }

    it('mirrors incoming data into the edit buffer when not editing', () => {
      component.componentData = { title: 'Fresh' };

      component.ngOnChanges(dataChange({ title: 'Old' }, { title: 'Fresh' }));

      expect(component.editingData).toEqual({ title: 'Fresh' });
    });

    it('preserves in-flight edits while the overlay is open', () => {
      component.isEditing = true;
      component.editingData = { title: 'User typing' };
      component.componentData = { title: 'Fresh' };

      component.ngOnChanges(dataChange({ title: 'Old' }, { title: 'Fresh' }));

      expect(component.editingData).toEqual({ title: 'User typing' });
    });

    it('re-renders the dynamic component when the definition changes', () => {
      component.ngOnChanges({
        componentDef: {
          previousValue: undefined,
          currentValue: mockComponentDef,
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(component.dynamicComponentRef).not.toBeNull();
    });
  });

  describe('dynamic component rendering', () => {
    it('creates the inner component and pushes merged data into it', async () => {
      component.componentData = { title: 'From data' };
      component.ngAfterViewInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(component.dynamicComponentRef).not.toBeNull();
      const inner = component.dynamicComponentRef
        ?.instance as MockTestComponent;
      expect(inner.title).toBe('From data');
      expect(inner.content).toBe('Default Content');
    });

    it('leaves the ref null when creating the inner component throws', () => {
      jest
        .spyOn(component.componentHost, 'createComponent')
        .mockImplementation(() => {
          throw new Error('cannot create');
        });
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);

      component.ngOnChanges({
        componentDef: {
          previousValue: undefined,
          currentValue: mockComponentDef,
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(component.dynamicComponentRef).toBeNull();
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it('skips rendering when there is no component on the definition', () => {
      component.componentDef = {
        id: 'no-component',
        name: 'No component',
        component: undefined as unknown as typeof MockTestComponent,
      };

      component.ngOnChanges({
        componentDef: {
          previousValue: undefined,
          currentValue: component.componentDef,
          firstChange: false,
          isFirstChange: () => false,
        },
      });

      expect(component.dynamicComponentRef).toBeNull();
    });

    it('does not schedule a render when the definition has no component', () => {
      component.componentDef = {
        id: 'no-component',
        name: 'No component',
        component: undefined as unknown as typeof MockTestComponent,
      };
      const createSpy = jest.spyOn(component.componentHost, 'createComponent');

      component.ngAfterViewInit();

      expect(createSpy).not.toHaveBeenCalled();
    });

    it('applies external data updates to the rendered component', async () => {
      component.ngAfterViewInit();
      await new Promise((resolve) => setTimeout(resolve, 0));

      component.updateComponentData({ title: 'Pushed in' });

      expect(component.componentData['title']).toBe('Pushed in');
      expect(component.editingData['title']).toBe('Pushed in');
      expect(
        (component.dynamicComponentRef?.instance as MockTestComponent).title
      ).toBe('Pushed in');
    });

    it('does not clobber the edit buffer during an external update while editing', async () => {
      component.ngAfterViewInit();
      await new Promise((resolve) => setTimeout(resolve, 0));
      component.isEditing = true;
      component.editingData = { title: 'User typing' };

      component.updateComponentData({ title: 'Pushed in' });

      expect(component.editingData['title']).toBe('User typing');
      expect(component.componentData['title']).toBe('Pushed in');
    });

    it('destroys the rendered component on destroy', async () => {
      component.ngAfterViewInit();
      await new Promise((resolve) => setTimeout(resolve, 0));
      const destroySpy = jest.spyOn(
        component.dynamicComponentRef as { destroy: () => void },
        'destroy'
      );

      component.ngOnDestroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(component.dynamicComponentRef).toBeNull();
    });
  });

  describe('lock and hover interaction', () => {
    function clickOn(element: HTMLElement): Event {
      const event = new MouseEvent('click', { bubbles: true });
      Object.defineProperty(event, 'target', { value: element });
      jest.spyOn(event, 'stopPropagation');
      return event;
    }

    it('locks on click, disabling hover, and unlocks on the next click', () => {
      const emit = jest.spyOn(component.selectionChanged, 'emit');
      component.isHovered = true;

      component.onClick(clickOn(document.createElement('div')));
      expect(component.isLocked).toBe(true);
      expect(component.isHovered).toBe(false);

      component.onClick(clickOn(document.createElement('div')));
      expect(component.isLocked).toBe(false);
      expect(emit).toHaveBeenCalledTimes(2);
    });

    it('ignores clicks that land on the control buttons', () => {
      const emit = jest.spyOn(component.selectionChanged, 'emit');
      const controls = document.createElement('div');
      controls.className = 'control-buttons';
      const button = document.createElement('button');
      controls.appendChild(button);

      component.onClick(clickOn(button));

      expect(component.isLocked).toBe(false);
      expect(emit).not.toHaveBeenCalled();
    });

    it('keeps hover state pinned while locked', () => {
      component.isLocked = true;

      component.onMouseEnter();
      expect(component.isHovered).toBe(false);

      component.isHovered = true;
      component.onMouseLeave();
      expect(component.isHovered).toBe(true);
    });
  });

  describe('overlay event isolation', () => {
    it.each([
      ['onOverlayClick' as const],
      ['onOverlayMouseDown' as const],
      ['onOverlayKeyDown' as const],
      ['onOverlayKeyUp' as const],
      ['onOverlayKeyPress' as const],
      ['onOverlayPaste' as const],
    ])('%s stops propagation to the editor', (method) => {
      const stopPropagation = jest.fn();
      const event = {
        stopPropagation,
        key: 'a',
        target: document.createElement('input'),
      };

      (component[method] as unknown as (e: typeof event) => void)(event);

      expect(stopPropagation).toHaveBeenCalled();
    });
  });

  describe('document click handling', () => {
    let wrapper: HTMLElement;
    let overlay: HTMLElement;
    let outside: HTMLElement;

    beforeEach(() => {
      wrapper = document.createElement('div');
      wrapper.className = 'component-editor-wrapper';
      overlay = document.createElement('div');
      overlay.className = 'quick-edit-overlay';
      wrapper.appendChild(overlay);
      outside = document.createElement('div');
      document.body.append(wrapper, outside);
    });

    afterEach(() => {
      wrapper.remove();
      outside.remove();
    });

    function documentClick(target: HTMLElement): MouseEvent {
      const event = new MouseEvent('click');
      Object.defineProperty(event, 'target', { value: target });
      return event;
    }

    it('does nothing when the overlay is closed', () => {
      component.isEditing = false;

      component.onDocumentClick(documentClick(outside));

      expect(component.isEditing).toBe(false);
    });

    it('closes the overlay when clicking outside the wrapper', () => {
      component.isEditing = true;

      component.onDocumentClick(documentClick(outside));

      expect(component.isEditing).toBe(false);
    });

    it('keeps the overlay open when clicking inside it', () => {
      component.isEditing = true;

      component.onDocumentClick(documentClick(overlay));

      expect(component.isEditing).toBe(true);
    });

    it('closes the overlay when clicking elsewhere in the wrapper', () => {
      component.isEditing = true;
      const inWrapper = document.createElement('div');
      wrapper.appendChild(inWrapper);

      component.onDocumentClick(documentClick(inWrapper));

      expect(component.isEditing).toBe(false);
    });
  });

  describe('quick edit lifecycle', () => {
    it('closes an open overlay before duplicating', () => {
      component.isEditing = true;
      const emit = jest.spyOn(component.duplicateRequested, 'emit');

      component.onDuplicateClick({
        stopPropagation: jest.fn(),
      } as unknown as MouseEvent);

      expect(component.isEditing).toBe(false);
      expect(emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('closes an open overlay before deleting', () => {
      component.isEditing = true;
      const emit = jest.spyOn(component.deleteRequested, 'emit');

      component.onDeleteClick({
        stopPropagation: jest.fn(),
      } as unknown as MouseEvent);

      expect(component.isEditing).toBe(false);
      expect(emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('closes edit mode again when the edit button is toggled off', () => {
      const event = { stopPropagation: jest.fn() } as unknown as MouseEvent;
      component.onEditClick(event);
      component.onEditClick(event);

      expect(component.isEditing).toBe(false);
    });

    it('drops the temporary JSON mirrors when saving', () => {
      component.componentDef = {
        ...mockComponentDef,
        properties: [
          { key: 'items', type: 'array', label: 'Items' },
          { key: 'config', type: 'object', label: 'Config' },
          { key: 'title', type: 'string', label: 'Title' },
        ],
      };
      component.componentData = { title: 'Old' };
      component.editingData = {
        title: 'New',
        items: [1],
        items_json: '[1]',
        config: { a: 1 },
        config_json: '{"a":1}',
      };
      const emit = jest.spyOn(component.propertiesChanged, 'emit');

      component.saveQuickEdit();

      expect(emit).toHaveBeenCalledWith({
        instance: mockComponentInstance,
        data: { title: 'New', items: [1], config: { a: 1 } },
      });
      expect(component.componentData['title']).toBe('New');
      expect(component.isEditing).toBe(false);
    });
  });
});
