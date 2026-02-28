import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentSelectorComponent } from './component-selector.component';
import { InjectableComponent } from '../interfaces/component-injection.interface';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import {
  IconComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';

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

describe('ComponentSelectorComponent', () => {
  let component: ComponentSelectorComponent;
  let fixture: ComponentFixture<ComponentSelectorComponent>;

  const mockComponents: InjectableComponent[] = [
    {
      id: 'comp1',
      name: 'Component 1',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: {} as any,
      category: 'Cat1',
      description: 'Desc 1',
      icon: 'icon1',
    },
    {
      id: 'comp2',
      name: 'Component 2',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: {} as any,
      category: 'Cat2',
      description: 'Desc 2',
      icon: 'icon2',
    },
    {
      id: 'comp3',
      name: 'Component 3',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: {} as any,
      category: 'Cat1',
      description: 'Desc 3',
      icon: 'icon3',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentSelectorComponent],
    })
      .overrideComponent(ComponentSelectorComponent, {
        remove: { imports: [IconComponent, ButtonComponent, CardComponent] },
        add: {
          imports: [
            MockButtonComponent,
            MockCardComponent,
            MockMatIconComponent,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ComponentSelectorComponent);
    component = fixture.componentInstance;
    component.components = mockComponents;
    component.isVisible = true;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Categories', () => {
    it('should derive unique categories including "All"', () => {
      const categories = component.categories;
      expect(categories).toContain('All');
      expect(categories).toContain('Cat1');
      expect(categories).toContain('Cat2');
      expect(categories.length).toBe(3);
    });

    it('should select category', () => {
      component.selectCategory('Cat1');
      expect(component.selectedCategory).toBe('Cat1');
    });
  });

  describe('Filtering', () => {
    it('should return all components when selectedCategory is "All"', () => {
      component.selectCategory('All');
      expect(component.filteredComponents.length).toBe(3);
    });

    it('should filter components by category', () => {
      component.selectCategory('Cat1');
      expect(component.filteredComponents.length).toBe(2);
      expect(
        component.filteredComponents.every((c) => c.category === 'Cat1')
      ).toBe(true);
    });
  });

  describe('Selection', () => {
    it('should emit componentSelected event', () => {
      jest.spyOn(component.componentSelected, 'emit');
      const target = mockComponents[0];

      component.selectComponent(target);

      expect(component.componentSelected.emit).toHaveBeenCalledWith(target);
    });
  });

  describe('Closing', () => {
    it('should emit closed event', () => {
      jest.spyOn(component.closed, 'emit');

      component.onClose();

      expect(component.closed.emit).toHaveBeenCalled();
    });
  });
});
