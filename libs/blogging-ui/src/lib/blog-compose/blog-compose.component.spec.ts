import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BlogComposeComponent } from './blog-compose.component';
import { FormsModule, NG_VALUE_ACCESSOR, ControlValueAccessor } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input, Output, EventEmitter, forwardRef, ViewContainerRef, Directive } from '@angular/core';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { ComponentInjectionService } from './services/component-injection.service';
import { Editor } from '@tiptap/core';
import { ComponentInjectionAPI, InjectableComponent } from './interfaces/component-injection.interface';

// Import real components to remove them
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { ContextMenuComponent } from '../context-menu/context-menu.component';
import { ComponentSelectorComponent } from './components/component-selector.component';
import { PropertyEditorComponent } from './components/property-editor.component';
import { RichTextToolbarComponent } from './components/rich-text-toolbar.component';
import { TiptapEditorDirective } from 'ngx-tiptap';

import { of, ReplaySubject } from 'rxjs';

// Mock child components
@Component({ selector: 'otui-card', standalone: true, template: '<ng-content></ng-content>' })
export class MockCardComponent {
  @Input() variantOverrides: any;
}

@Component({ selector: 'lib-text-input', standalone: true, template: '', providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MockTextInputComponent), multi: true }] })
export class MockTextInputComponent implements ControlValueAccessor {
  @Input() label: any; @Input() placeholder: any; @Input() id: any; @Input() type: any;
  writeValue() { } registerOnChange() { } registerOnTouched() { }
}

@Component({ selector: 'otui-button', standalone: true, template: '<ng-content></ng-content>' })
export class MockButtonComponent { @Input() variant: any; @Output() action = new EventEmitter<void>(); }

@Component({ selector: 'lib-context-menu', standalone: true, template: '' })
export class MockContextMenuComponent { @Input() x: any; @Input() y: any; @Input() editor: any; }

@Component({ selector: 'lib-component-selector', standalone: true, template: '' })
export class MockComponentSelectorComponent { @Input() isVisible: any; @Input() components: any; }

@Component({ selector: 'lib-property-editor', standalone: true, template: '' })
export class MockPropertyEditorComponent { @Input() isVisible: any; @Input() componentInstance: any; @Input() propertyDefinitions: any; }

@Component({ selector: 'lib-rich-text-toolbar', standalone: true, template: '' })
export class MockRichTextToolbarComponent { @Input() editor: any; }

@Directive({ selector: 'tiptap-editor', standalone: true })
export class MockTiptapEditorDirective {
  @Input() editor: any;
  @Input() ngModel: any;
}

// Mock ngx-tiptap
jest.mock('ngx-tiptap', () => ({
  TiptapEditorDirective: class { }
}));

// Mock Editor
const mockEditorCommands = {
  setContent: jest.fn(),
  insertAngularComponent: jest.fn(),
  updateAngularComponent: jest.fn(),
  removeAngularComponent: jest.fn(),
  setImage: jest.fn().mockReturnThis(),
  run: jest.fn(),
  // Focus is handled separately in chain
};

const mockEditorChain = {
  focus: jest.fn().mockReturnValue({
    setImage: jest.fn().mockReturnValue({ run: jest.fn() })
  }),
  ...mockEditorCommands
};

class MockEditor {
  commands = {
    ...mockEditorCommands,
    focus: jest.fn().mockReturnThis() // Commands also has focus
  };
  chain = jest.fn().mockReturnValue(mockEditorChain);
  on = jest.fn();
  destroy = jest.fn();
  view = { dom: { addEventListener: jest.fn() } };
  getHTML = jest.fn().mockReturnValue('<p>Content</p>');
  setEditable = jest.fn();
}

jest.mock('@tiptap/core', () => {
  return {
    Editor: jest.fn().mockImplementation(() => new MockEditor()),
    Extension: { create: jest.fn() },
    Node: { create: jest.fn() },
    markInputRule: jest.fn(),
    mergeAttributes: jest.fn()
  };
});

// Mock Extensions
jest.mock('@tiptap/starter-kit', () => ({}));
jest.mock('@tiptap/extension-image', () => ({}));
jest.mock('@tiptap/extension-subscript', () => ({}));
jest.mock('@tiptap/extension-superscript', () => ({}));
jest.mock('@tiptap/extension-underline', () => ({}));
jest.mock('@tiptap/extension-text-align', () => ({ configure: () => ({}) }));
jest.mock('@tiptap/extension-table', () => ({ Table: { configure: () => ({}) } }));
jest.mock('@tiptap/extension-table-row', () => ({}));
jest.mock('@tiptap/extension-table-header', () => ({}));
jest.mock('@tiptap/extension-table-cell', () => ({}));

// Mock compose-lib
jest.mock('@optimistic-tanuki/compose-lib', () => ({
  AngularComponentNode: {
    extend: jest.fn().mockReturnValue({ configure: jest.fn() })
  }
}));

describe('BlogComposeComponent', () => {
  let component: BlogComposeComponent;
  let fixture: ComponentFixture<BlogComposeComponent>;
  let themeServiceSpy: any;
  let componentInjectionServiceSpy: any;

  beforeEach(async () => {
    themeServiceSpy = {
      themeColors$: of({
        background: '#ffffff',
        foreground: '#000000',
        accent: '#5969c3',
        complementary: '#59c360',
        accentGradients: { light: 'linear-gradient(...)', dark: 'linear-gradient(...)' },
        complementaryShades: [['#eee'], ['#ddd'], ['#ccc']]
      }),
      getTheme: jest.fn().mockReturnValue('light')
    };

    componentInjectionServiceSpy = {
      setViewContainer: jest.fn(),
      setWrapperCallbacks: jest.fn(),
      registerComponent: jest.fn(),
      unregisterComponent: jest.fn(),
      getRegisteredComponents: jest.fn().mockReturnValue([]),
      getComponentsByCategory: jest.fn().mockReturnValue([]),
      getInstance: jest.fn(),
      renderComponentInto: jest.fn(),
      removeComponent: jest.fn(),
      moveComponent: jest.fn(),
      updateComponent: jest.fn(),
      getActiveComponents: jest.fn().mockReturnValue([])
    };

    await TestBed.configureTestingModule({
      imports: [BlogComposeComponent, FormsModule, NoopAnimationsModule],
      providers: [
        { provide: ThemeService, useValue: themeServiceSpy },
        { provide: ComponentInjectionService, useValue: componentInjectionServiceSpy }
      ]
    })
      .overrideComponent(BlogComposeComponent, {
        remove: {
          imports: [
            CardComponent, TextInputComponent, ButtonComponent,
            ContextMenuComponent, ComponentSelectorComponent,
            PropertyEditorComponent, RichTextToolbarComponent,
            TiptapEditorDirective
          ]
        },
        add: {
          imports: [
            MockCardComponent, MockTextInputComponent, MockButtonComponent,
            MockContextMenuComponent, MockComponentSelectorComponent,
            MockPropertyEditorComponent, MockRichTextToolbarComponent,
            MockTiptapEditorDirective
          ]
        }
      })
      .compileComponents();

    fixture = TestBed.createComponent(BlogComposeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize editor on view init', async () => {
    fixture.detectChanges(); // triggers ngAfterViewInit
    await new Promise(resolve => setTimeout(resolve, 0)); // wait for promise
    expect(component.editor).toBeDefined();
    expect(componentInjectionServiceSpy.setViewContainer).toHaveBeenCalled();
  });

  it('should register default components', async () => {
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 0));
    // Check if registerComponent was called multiple times
    expect(componentInjectionServiceSpy.registerComponent).toHaveBeenCalled();
  });

  describe('ControlValueAccessor', () => {
    it('should write value', async () => {
      fixture.detectChanges();
      await new Promise(resolve => setTimeout(resolve, 0));
      const value = { title: 'Test', content: 'Content', links: [], attachments: [] };
      component.writeValue(value);
      expect(component.title).toBe('Test');
      expect(component.content).toBe('Content');
      // Should update editor content
      expect(component.editor.commands.setContent).toHaveBeenCalledWith('Content');
    });

    it('should register on change', () => {
      const fn = jest.fn();
      component.registerOnChange(fn);
      // Trigger change
      component.title = 'New Title';
      expect(fn).toHaveBeenCalled();
    });
  });

  describe('Component Injection', () => {
    it('should show component selector', () => {
      component.showComponentSelector();
      expect(component.isComponentSelectorVisible).toBe(true);
    });

    it('should inject component', async () => {
      const mockComponentDef = { id: 'test', name: 'Test' };
      // Setup mock before component init
      componentInjectionServiceSpy.getRegisteredComponents.mockReturnValue([mockComponentDef]);
      componentInjectionServiceSpy.getInstance.mockReturnValue({ instanceId: 'inst-1', data: {} });
      const mockInstance = { instanceId: 'inst-1', data: {}, componentDef: mockComponentDef };
      componentInjectionServiceSpy.getActiveComponents.mockImplementation(() => [mockInstance]);

      fixture.detectChanges(); // triggers ngAfterViewInit
      await new Promise(resolve => setTimeout(resolve, 100)); // wait for editor init

      await component.injectComponent('test');

      expect(component.editor.commands.insertAngularComponent).toHaveBeenCalled();
      expect(component.getActiveComponents().length).toBe(1);
    });
  });
});
