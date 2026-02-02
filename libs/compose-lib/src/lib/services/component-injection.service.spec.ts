import { TestBed } from '@angular/core/testing';
import { Component, ViewContainerRef } from '@angular/core';
import { ComponentInjectionService } from './component-injection.service';
import {
  InjectableComponent,
  InjectedComponentInstance,
} from '../interfaces/component-injection.interface';
import { ComponentInjectionStateManager } from '../state/component-injection-state';

@Component({
  selector: 'test-component',
  template: '<div>Test Component</div>',
  standalone: true,
})
class TestComponent {
  testProp = 'default';
}

describe('ComponentInjectionService', () => {
  let service: ComponentInjectionService;
  let viewContainerRef: any;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ComponentInjectionService);

    // Create a mock for ViewContainerRef
    viewContainerRef = {
      createComponent: jest.fn(),
      indexOf: jest.fn(),
      move: jest.fn(),
    };
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('registerComponent', () => {
    it('should register a component', () => {
      const testComponent: InjectableComponent = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        category: 'Test',
      };

      service.registerComponent(testComponent);
      const registered = service.registeredComponents();

      expect(registered).toContain(testComponent);
      expect(registered.length).toBe(1);
    });

    it('should register multiple components', () => {
      const component1: InjectableComponent = {
        id: 'test-1',
        name: 'Test 1',
        component: TestComponent,
      };

      const component2: InjectableComponent = {
        id: 'test-2',
        name: 'Test 2',
        component: TestComponent,
      };

      service.registerComponent(component1);
      service.registerComponent(component2);

      const registered = service.registeredComponents();
      expect(registered.length).toBe(2);
    });
  });

  describe('unregisterComponent', () => {
    it('should unregister a component', () => {
      const testComponent: InjectableComponent = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      };

      service.registerComponent(testComponent);
      service.unregisterComponent('test-component');

      const registered = service.registeredComponents();
      expect(registered.length).toBe(0);
    });

    it('should not error when unregistering non-existent component', () => {
      expect(() => {
        service.unregisterComponent('non-existent');
      }).not.toThrow();
    });
  });

  describe('registeredComponents', () => {
    it('should return empty array when no components registered', () => {
      const components = service.registeredComponents();
      expect(components).toEqual([]);
    });

    it('should return all registered components', () => {
      const component1: InjectableComponent = {
        id: 'test-1',
        name: 'Test 1',
        component: TestComponent,
      };

      const component2: InjectableComponent = {
        id: 'test-2',
        name: 'Test 2',
        component: TestComponent,
      };

      service.registerComponent(component1);
      service.registerComponent(component2);

      const components = service.registeredComponents();
      expect(components.length).toBe(2);
    });
  });

  describe('componentsByCategory', () => {
    beforeEach(() => {
      const component1: InjectableComponent = {
        id: 'test-1',
        name: 'Test 1',
        component: TestComponent,
        category: 'Category A',
      };

      const component2: InjectableComponent = {
        id: 'test-2',
        name: 'Test 2',
        component: TestComponent,
        category: 'Category B',
      };

      const component3: InjectableComponent = {
        id: 'test-3',
        name: 'Test 3',
        component: TestComponent,
        category: 'Category A',
      };

      service.registerComponent(component1);
      service.registerComponent(component2);
      service.registerComponent(component3);
    });

    it('should return components by category', () => {
      const categoryA = service.componentsByCategory().get('Category A') || [];
      expect(categoryA.length).toBe(2);
      expect(categoryA.every((c: any) => c.category === 'Category A')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const components = service.componentsByCategory().get('Non-existent') || [];
      expect(components).toEqual([]);
    });
  });

  describe('setViewContainer', () => {
    it('should set the view container', () => {
      expect(() => {
        service.setViewContainer(viewContainerRef);
      }).not.toThrow();
    });
  });

  describe('setWrapperCallbacks', () => {
    it('should set wrapper callbacks', () => {
      const callbacks = {
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onMoveUp: jest.fn(),
        onMoveDown: jest.fn(),
        onSelection: jest.fn(),
      };

      expect(() => {
        service.setWrapperCallbacks(callbacks);
      }).not.toThrow();
    });

    it('should accept partial callbacks', () => {
      const callbacks = {
        onEdit: jest.fn(),
      };

      expect(() => {
        service.setWrapperCallbacks(callbacks);
      }).not.toThrow();
    });
  });

  describe('activeComponents', () => {
    it('should return empty array when no components are active', () => {
      const active = service.activeComponents();
      expect(active).toEqual([]);
    });
  });

  describe('getInstance', () => {
    it('should return undefined for non-existent instance', () => {
      const instance = service.getInstance('non-existent');
      expect(instance).toBeUndefined();
    });
  });

  describe('clear all components', () => {
    it('should have no active components initially', () => {
      const active = service.activeComponents();
      expect(active).toEqual([]);
    });
  });

  describe('renderComponentInto', () => {
    it('should create a wrapper component for content projection', () => {
      // Register a test component
      const testComponent: InjectableComponent = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
        category: 'Test',
        data: { testProp: 'initial' }
      };
      
      service.registerComponent(testComponent);
      
      // Create mock event emitters
      const mockEditRequested = { subscribe: jest.fn() };
      const mockDeleteRequested = { subscribe: jest.fn() };
      const mockMoveUpRequested = { subscribe: jest.fn() };
      const mockMoveDownRequested = { subscribe: jest.fn() };
      const mockSelectionChanged = { subscribe: jest.fn() };
      
      // Create mock component refs
      const mockWrapperRef: any = {
        instance: { 
          componentInstance: null,
          editRequested: mockEditRequested,
          deleteRequested: mockDeleteRequested,
          moveUpRequested: mockMoveUpRequested,
          moveDownRequested: mockMoveDownRequested,
          selectionChanged: mockSelectionChanged,
        },
        location: { nativeElement: document.createElement('div') },
        changeDetectorRef: { detectChanges: jest.fn() },
        destroy: jest.fn(),
      };
      
      const mockComponentRef: any = {
        instance: { testProp: 'initial' },
        location: { nativeElement: document.createElement('span') },
        changeDetectorRef: { detectChanges: jest.fn() },
      };
      
      // Setup mock to return wrapper first, then component
      viewContainerRef.createComponent = jest.fn()
        .mockReturnValueOnce(mockWrapperRef)
        .mockReturnValueOnce(mockComponentRef);
      
      service.setViewContainer(viewContainerRef);
      
      // Create a target element
      const targetElement = document.createElement('div');
      
      // Call renderComponentInto
      const instance = service.renderComponentInto(
        'test-component',
        'test-instance-123',
        { testProp: 'updated' },
        targetElement
      );
      
      // Verify wrapper was created first (first call to createComponent)
      expect(viewContainerRef.createComponent).toHaveBeenCalledTimes(2);
      
      // Verify the wrapper's componentInstance was set
      expect(mockWrapperRef.instance.componentInstance).toBeTruthy();
      expect(mockWrapperRef.instance.componentInstance.instanceId).toBe('test-instance-123');
      
      // Verify event handlers were subscribed
      expect(mockEditRequested.subscribe).toHaveBeenCalled();
      expect(mockDeleteRequested.subscribe).toHaveBeenCalled();
      expect(mockMoveUpRequested.subscribe).toHaveBeenCalled();
      expect(mockMoveDownRequested.subscribe).toHaveBeenCalled();
      expect(mockSelectionChanged.subscribe).toHaveBeenCalled();
      
      // Verify the component element was appended to the wrapper (content projection)
      expect(mockWrapperRef.location.nativeElement.children.length).toBeGreaterThan(0);
      
      // Verify the wrapper was appended to the target element
      expect(targetElement.children.length).toBeGreaterThan(0);
      
      // Verify change detection was triggered
      expect(mockComponentRef.changeDetectorRef.detectChanges).toHaveBeenCalled();
      expect(mockWrapperRef.changeDetectorRef.detectChanges).toHaveBeenCalled();
    });

    it('should throw error if view container not set', () => {
      const testComponent: InjectableComponent = {
        id: 'test-component',
        name: 'Test Component',
        component: TestComponent,
      };
      
      service.registerComponent(testComponent);
      
      const targetElement = document.createElement('div');
      
      expect(() => {
        service.renderComponentInto(
          'test-component',
          'test-instance',
          {},
          targetElement
        );
      }).toThrow('ViewContainer not set');
    });

    it('should throw error if component not found', () => {
      service.setViewContainer(viewContainerRef);
      const targetElement = document.createElement('div');
      
      expect(() => {
        service.renderComponentInto(
          'non-existent',
          'test-instance',
          {},
          targetElement
        );
      }).toThrow('Component non-existent not found in unified registry');
    });
  });
});
