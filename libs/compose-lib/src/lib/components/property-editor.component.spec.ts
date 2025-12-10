import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { PropertyEditorComponent, PropertyDefinition } from './property-editor.component';
import { Component } from '@angular/core';
import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';

@Component({
  selector: 'test-host',
  template: '<div>Test</div>',
  standalone: true,
})
class TestHostComponent {}

describe('PropertyEditorComponent', () => {
  let component: PropertyEditorComponent;
  let fixture: ComponentFixture<PropertyEditorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PropertyEditorComponent, FormsModule],
    }).compileComponents();

    fixture = TestBed.createComponent(PropertyEditorComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default visibility set to false', () => {
    expect(component.isVisible).toBe(false);
  });

  it('should initialize editedData as empty object', () => {
    expect(component.editedData).toEqual({});
  });

  describe('Property Definitions', () => {
    it('should accept string property type', () => {
      const prop: PropertyDefinition = {
        key: 'title',
        type: 'string',
        label: 'Title',
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions.length).toBe(1);
      expect(component.propertyDefinitions[0].type).toBe('string');
    });

    it('should accept number property type', () => {
      const prop: PropertyDefinition = {
        key: 'count',
        type: 'number',
        label: 'Count',
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].type).toBe('number');
    });

    it('should accept boolean property type', () => {
      const prop: PropertyDefinition = {
        key: 'enabled',
        type: 'boolean',
        label: 'Enabled',
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].type).toBe('boolean');
    });

    it('should accept select property type with options', () => {
      const prop: PropertyDefinition = {
        key: 'size',
        type: 'select',
        label: 'Size',
        options: [
          { label: 'Small', value: 'sm' },
          { label: 'Medium', value: 'md' },
          { label: 'Large', value: 'lg' },
        ],
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].options?.length).toBe(3);
    });

    it('should support property with description', () => {
      const prop: PropertyDefinition = {
        key: 'title',
        type: 'string',
        label: 'Title',
        description: 'Enter the title text',
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].description).toBe('Enter the title text');
    });

    it('should support property with default value', () => {
      const prop: PropertyDefinition = {
        key: 'enabled',
        type: 'boolean',
        label: 'Enabled',
        defaultValue: true,
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].defaultValue).toBe(true);
    });

    it('should support isOutput property', () => {
      const prop: PropertyDefinition = {
        key: 'onClick',
        type: 'string',
        label: 'On Click',
        isOutput: true,
        outputSchema: { type: 'event' },
      };

      component.propertyDefinitions = [prop];
      fixture.detectChanges();

      expect(component.propertyDefinitions[0].isOutput).toBe(true);
      expect(component.propertyDefinitions[0].outputSchema).toEqual({ type: 'event' });
    });
  });

  describe('Component Instance', () => {
    it('should accept component instance', () => {
      const mockComponent: InjectableComponent = {
        id: 'test',
        name: 'Test Component',
        component: TestHostComponent,
      };

      const instance: Partial<InjectedComponentInstance> = {
        instanceId: 'test-1',
        componentDef: mockComponent,
        data: { title: 'Test' },
      };

      component.componentInstance = instance as InjectedComponentInstance;
      fixture.detectChanges();

      expect(component.componentInstance).toBeDefined();
      expect(component.componentInstance?.instanceId).toBe('test-1');
    });
  });

  describe('Event Emitters', () => {
    it('should emit close event', (done) => {
      component.closed.subscribe(() => {
        expect(true).toBe(true);
        done();
      });

      component.onClose();
    });

    it('should emit propertiesUpdated event with edited data', (done) => {
      const testData = { title: 'New Title', enabled: true };
      component.editedData = testData;

      component.propertiesUpdated.subscribe((data) => {
        expect(data).toEqual(testData);
        done();
      });

      component.onSave();
    });

    it('should clean up temporary JSON strings after save', () => {
      component.propertyDefinitions = [{
        key: 'items',
        type: 'array',
        label: 'Items'
      }];
      component.editedData = {
        items: ['item1'],
        items_json: '["item1"]'
      };

      component.propertiesUpdated.subscribe((data) => {
        expect(data['items_json']).toBeUndefined();
        expect(data['items']).toEqual(['item1']);
      });

      component.onSave();
    });
  });

  describe('Helper Methods', () => {
    it('getPlaceholder should return default placeholder for string', () => {
      const prop: PropertyDefinition = {
        key: 'title',
        type: 'string',
        label: 'Title',
      };

      const placeholder = component.getPlaceholder(prop);
      expect(placeholder).toBe('Enter text...');
    });

    it('getPlaceholder should return default value as string', () => {
      const prop: PropertyDefinition = {
        key: 'title',
        type: 'string',
        label: 'Title',
        defaultValue: 'Default Title',
      };

      const placeholder = component.getPlaceholder(prop);
      expect(placeholder).toBe('Default Title');
    });

    it('getPlaceholder should convert number to string', () => {
      const prop: PropertyDefinition = {
        key: 'count',
        type: 'number',
        label: 'Count',
        defaultValue: 42,
      };

      const placeholder = component.getPlaceholder(prop);
      expect(placeholder).toBe('42');
    });

    it('getPlaceholder should return "0" for number type without default', () => {
      const prop: PropertyDefinition = {
        key: 'count',
        type: 'number',
        label: 'Count',
      };

      const placeholder = component.getPlaceholder(prop);
      expect(placeholder).toBe('0');
    });

    it('getPlaceholder should return URL placeholder for url type', () => {
      const prop: PropertyDefinition = {
        key: 'link',
        type: 'url',
        label: 'Link',
      };

      const placeholder = component.getPlaceholder(prop);
      expect(placeholder).toBe('https://example.com');
    });
  });

  describe('Visibility', () => {
    it('should toggle visibility', () => {
      expect(component.isVisible).toBe(false);
      
      component.isVisible = true;
      fixture.detectChanges();
      
      expect(component.isVisible).toBe(true);
    });
  });
});
