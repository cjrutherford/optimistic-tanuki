import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PropertyEditorComponent } from './property-editor.component';
import {
  InjectedComponentInstance,
  PropertyDefinition,
} from '../interfaces/component-injection.interface';
import {
  Component,
  Input,
  Output,
  EventEmitter,
  forwardRef,
} from '@angular/core';
import {
  ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  FormsModule,
} from '@angular/forms';
import {
  IconComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'lib-text-input',
  standalone: true,
  template: '',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MockTextInputComponent),
      multi: true,
    },
  ],
})
class MockTextInputComponent implements ControlValueAccessor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() id: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() type: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() placeholder: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() label: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  writeValue(obj: any): void {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerOnChange(fn: any): void {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  registerOnTouched(fn: any): void {}
}

@Component({
  selector: 'otui-button',
  standalone: true,
  template: '<ng-content></ng-content>',
})
class MockButtonComponent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  @Input() variant: any;
  @Output() action = new EventEmitter<void>();
}

@Component({
  selector: 'otui-card',
  standalone: true,
  template: '<ng-content></ng-content>',
})
class MockCardComponent {}

@Component({
  selector: 'mat-icon',
  standalone: true,
  template: '',
})
class MockMatIconComponent {}

describe('PropertyEditorComponent', () => {
  let component: PropertyEditorComponent;
  let fixture: ComponentFixture<PropertyEditorComponent>;

  const mockComponentInstance: InjectedComponentInstance = {
    instanceId: 'test-id',
    componentDef: {
      id: 'test',
      name: 'Test Component',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: {} as any,
      category: 'Test',
      description: 'A test component',
      icon: '',
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    componentRef: {} as any,
    data: {
      title: 'Initial Title',
      count: 10,
      tags: ['a', 'b'],
      config: { enabled: true },
    },
  };

  const mockPropertyDefinitions: PropertyDefinition[] = [
    { key: 'title', type: 'string', label: 'Title' },
    { key: 'count', type: 'number', label: 'Count' },
    { key: 'tags', type: 'array', label: 'Tags' },
    { key: 'config', type: 'object', label: 'Config' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyEditorComponent, FormsModule],
    })
      .overrideComponent(PropertyEditorComponent, {
        remove: {
          imports: [
            IconComponent,
            ButtonComponent,
            CardComponent,
            TextInputComponent,
          ],
        },
        add: {
          imports: [
            MockTextInputComponent,
            MockButtonComponent,
            MockCardComponent,
            MockMatIconComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(PropertyEditorComponent);
    component = fixture.componentInstance;
    component.componentInstance = mockComponentInstance;
    component.propertyDefinitions = mockPropertyDefinitions;
    component.isVisible = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize editedData from componentInstance', () => {
    component.ngOnInit();
    expect(component.editedData.title).toBe('Initial Title');
    expect(component.editedData.count).toBe(10);
    // Arrays and objects should be stringified
    expect(component.editedData.tags_json).toContain('"a"');
    expect(component.editedData.config_json).toContain('"enabled"');
  });

  describe('JSON handling', () => {
    it('should update array from JSON string', () => {
      const json = '["c", "d"]';
      component.updateArrayFromJson('tags', json);
      expect(component.editedData.tags).toEqual(['c', 'd']);
    });

    it('should NOT update array if JSON is invalid', () => {
      component.editedData.tags = ['original'];
      component.updateArrayFromJson('tags', 'invalid-json');
      expect(component.editedData.tags).toEqual(['original']);
    });

    it('should update object from JSON string', () => {
      const json = '{"enabled": false}';
      component.updateObjectFromJson('config', json);
      expect(component.editedData.config).toEqual({ enabled: false });
    });

    it('should NOT update object if JSON is invalid', () => {
      component.editedData.config = { original: true };
      component.updateObjectFromJson('config', 'invalid');
      expect(component.editedData.config).toEqual({ original: true });
    });
  });

  describe('Saving', () => {
    it('should emit cleaned data on save', () => {
      jest.spyOn(component.propertiesUpdated, 'emit');

      component.editedData = {
        title: 'New Title',
        count: 20,
        tags: ['x'],
        tags_json: '["x"]', // Should be removed
        config: { a: 1 },
        config_json: '{"a": 1}', // Should be removed
      };

      component.onSave();

      expect(component.propertiesUpdated.emit).toHaveBeenCalledWith({
        title: 'New Title',
        count: 20,
        tags: ['x'],
        config: { a: 1 },
      });
    });
  });

  describe('Placeholders', () => {
    it('should return default value string if present', () => {
      const prop: PropertyDefinition = {
        key: 'test',
        type: 'string',
        label: '',
        defaultValue: 'Default',
      };
      expect(component.getPlaceholder(prop)).toBe('Default');
    });

    it('should return type specific placeholder if no default', () => {
      expect(
        component.getPlaceholder({ key: 'k', type: 'string', label: '' })
      ).toBe('Enter text...');
      expect(
        component.getPlaceholder({ key: 'k', type: 'number', label: '' })
      ).toBe('0');
    });
  });
});
