import { TestBed } from '@angular/core/testing';
import { Component, ViewContainerRef } from '@angular/core';
import { ComponentInjectionService } from './component-injection.service';
import { InjectableComponent, InjectedComponentInstance } from '../interfaces/component-injection.interface';

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
      const registered = service.getRegisteredComponents();

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

      const registered = service.getRegisteredComponents();
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

      const registered = service.getRegisteredComponents();
      expect(registered.length).toBe(0);
    });

    it('should not error when unregistering non-existent component', () => {
      expect(() => {
        service.unregisterComponent('non-existent');
      }).not.toThrow();
    });
  });

  describe('getRegisteredComponents', () => {
    it('should return empty array when no components registered', () => {
      const components = service.getRegisteredComponents();
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

      const components = service.getRegisteredComponents();
      expect(components.length).toBe(2);
    });
  });

  describe('getComponentsByCategory', () => {
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
      const categoryA = service.getComponentsByCategory('Category A');
      expect(categoryA.length).toBe(2);
      expect(categoryA.every(c => c.category === 'Category A')).toBe(true);
    });

    it('should return empty array for non-existent category', () => {
      const components = service.getComponentsByCategory('Non-existent');
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

  describe('getActiveComponents', () => {
    it('should return empty array when no components are active', () => {
      const active = service.getActiveComponents();
      expect(active).toEqual([]);
    });
  });

  describe('getInstance', () => {
    it('should return undefined for non-existent instance', () => {
      const instance = service.getInstance('non-existent');
      expect(instance).toBeUndefined();
    });
  });

  describe('clearAllComponents', () => {
    it('should clear all components', () => {
      service.clearAllComponents();
      const active = service.getActiveComponents();
      expect(active).toEqual([]);
    });
  });
});
