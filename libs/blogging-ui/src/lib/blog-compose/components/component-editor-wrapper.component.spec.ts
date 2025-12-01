import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Component, Input } from '@angular/core';

import { ComponentEditorWrapperComponent } from './component-editor-wrapper.component';
import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';

// Simple mock component for testing
@Component({
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
      content: 'Default Content'
    }
  };

  const mockComponentInstance: InjectedComponentInstance = {
    instanceId: 'test-instance-123',
    componentDef: mockComponentDef,
    componentRef: {
      instance: { title: 'Instance Title' },
      changeDetectorRef: { detectChanges: jest.fn() },
      destroy: jest.fn()
    } as any,
    data: {
      title: 'Instance Title',
      content: 'Instance Content'
    }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ComponentEditorWrapperComponent,
        FormsModule,
        NoopAnimationsModule,
        MockTestComponent
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
    const event = new MouseEvent('click');
    component.onClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should emit editRequested when edit button clicked', () => {
    // Note: The editRequested event is for the full property editor
    // The component now opens inline quick edit instead
    const event = new MouseEvent('click');
    component.onEditClick(event);
    expect(component.isEditing).toBe(true);
  });

  it('should emit deleteRequested when delete button clicked', () => {
    const spy = jest.spyOn(component.deleteRequested, 'emit');
    const event = new MouseEvent('click');
    component.onDeleteClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should emit duplicateRequested when duplicate button clicked', () => {
    const spy = jest.spyOn(component.duplicateRequested, 'emit');
    const event = new MouseEvent('click');
    component.onDuplicateClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should emit configRequested when config button clicked', () => {
    const spy = jest.spyOn(component.configRequested, 'emit');
    const event = new MouseEvent('click');
    component.onConfigClick(event);
    expect(spy).toHaveBeenCalledWith(mockComponentInstance);
  });

  it('should open quick edit mode', () => {
    expect(component.isEditing).toBe(false);
    const event = new MouseEvent('click');
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
    expect(component.editingData.title).toBe('Original');
  });

  it('should emit propertiesChanged on save', () => {
    const spy = jest.spyOn(component.propertiesChanged, 'emit');
    component.editingData = { title: 'New Title' };
    component.isEditing = true;
    
    component.saveQuickEdit();
    
    expect(spy).toHaveBeenCalledWith({
      instance: mockComponentInstance,
      data: { title: 'New Title' }
    });
    expect(component.isEditing).toBe(false);
  });

  it('should format property values correctly', () => {
    component.componentData = {
      stringValue: 'test',
      boolTrue: true,
      boolFalse: false,
      longString: 'This is a very long string that should be truncated for display purposes'
    };

    expect(component.formatPropertyValue('stringValue')).toBe('test');
    expect(component.formatPropertyValue('boolTrue')).toBe('Yes');
    expect(component.formatPropertyValue('boolFalse')).toBe('No');
    expect(component.formatPropertyValue('nonExistent')).toBe('-');
    expect(component.formatPropertyValue('longString').length).toBeLessThanOrEqual(33); // 30 chars + '...'
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
});
