import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentSelectorComponent } from './component-selector.component';
import { Component } from '@angular/core';
import { InjectableComponent } from '../interfaces/component-injection.interface';

@Component({
  selector: 'test-component',
  template: '<div>Test</div>',
  standalone: true,
})
class TestComponent {}

describe('ComponentSelectorComponent', () => {
  let component: ComponentSelectorComponent;
  let fixture: ComponentFixture<ComponentSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentSelectorComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have default visibility set to false', () => {
    expect(component.isVisible).toBe(false);
  });

  it('should initialize with "All" selected category', () => {
    expect(component.selectedCategory).toBe('All');
  });

  describe('Component Registration', () => {
    it('should accept components input', () => {
      const testComponents: InjectableComponent[] = [
        {
          id: 'test-1',
          name: 'Test Component 1',
          component: TestComponent,
          category: 'Test',
        },
      ];

      component.components = testComponents;
      fixture.detectChanges();

      expect(component.components.length).toBe(1);
    });

    it('should extract unique categories from components', () => {
      const testComponents: InjectableComponent[] = [
        { id: 'test-1', name: 'Test 1', component: TestComponent, category: 'Category A' },
        { id: 'test-2', name: 'Test 2', component: TestComponent, category: 'Category B' },
        { id: 'test-3', name: 'Test 3', component: TestComponent, category: 'Category A' },
      ];

      component.components = testComponents;
      fixture.detectChanges();

      expect(component.categories.length).toBe(3); // 'All' + 'Category A' + 'Category B'
      expect(component.categories).toContain('All');
      expect(component.categories).toContain('Category A');
      expect(component.categories).toContain('Category B');
    });

    it('should always include "All" category', () => {
      const testComponents: InjectableComponent[] = [
        { id: 'test-1', name: 'Test 1', component: TestComponent },
        { id: 'test-2', name: 'Test 2', component: TestComponent, category: 'Category A' },
      ];

      component.components = testComponents;
      fixture.detectChanges();

      expect(component.categories).toContain('All');
    });
  });

  describe('Category Selection', () => {
    beforeEach(() => {
      const testComponents: InjectableComponent[] = [
        { id: 'test-1', name: 'Test 1', component: TestComponent, category: 'Category A' },
        { id: 'test-2', name: 'Test 2', component: TestComponent, category: 'Category B' },
        { id: 'test-3', name: 'Test 3', component: TestComponent, category: 'Category A' },
      ];

      component.components = testComponents;
      fixture.detectChanges();
    });

    it('should select a category', () => {
      component.selectCategory('Category A');
      expect(component.selectedCategory).toBe('Category A');
    });

    it('should filter components by selected category', () => {
      component.selectCategory('Category A');
      const filtered = component.filteredComponents;

      expect(filtered.length).toBe(2);
      expect(filtered.every(c => c.category === 'Category A')).toBe(true);
    });

    it('should show all components when "All" category selected', () => {
      component.selectCategory('All');
      const filtered = component.filteredComponents;

      expect(filtered.length).toBe(3);
    });

    it('should update filtered components when category changes', () => {
      component.selectCategory('Category A');
      let filtered = component.filteredComponents;
      expect(filtered.length).toBe(2);

      component.selectCategory('Category B');
      filtered = component.filteredComponents;
      expect(filtered.length).toBe(1);
    });

    it('should default to showing all components', () => {
      const filtered = component.filteredComponents;
      expect(filtered.length).toBe(3);
    });
  });

  describe('Component Selection', () => {
    it('should emit componentSelected event when component is selected', (done) => {
      const testComponent: InjectableComponent = {
        id: 'test-1',
        name: 'Test Component',
        component: TestComponent,
      };

      component.componentSelected.subscribe((selected) => {
        expect(selected).toEqual(testComponent);
        done();
      });

      component.selectComponent(testComponent);
    });
  });

  describe('Close Event', () => {
    it('should emit closed event when onClose is called', (done) => {
      component.closed.subscribe(() => {
        expect(true).toBe(true);
        done();
      });

      component.onClose();
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

  describe('Edge Cases', () => {
    it('should handle empty components array', () => {
      component.components = [];
      fixture.detectChanges();

      expect(component.categories).toEqual(['All']);
      expect(component.filteredComponents).toEqual([]);
    });

    it('should handle category selection to "All"', () => {
      const testComponents: InjectableComponent[] = [
        { id: 'test-1', name: 'Test 1', component: TestComponent, category: 'Category A' },
      ];

      component.components = testComponents;
      fixture.detectChanges();

      component.selectCategory('All');
      expect(component.selectedCategory).toBe('All');
      expect(component.filteredComponents.length).toBe(1);
    });
  });
});
