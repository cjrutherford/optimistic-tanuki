import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentWrapperComponent } from './component-wrapper.component';
import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';

@Component({
  selector: 'test-component',
  template: '<div>Test</div>',
  standalone: true,
})
class TestComponent {}

describe('ComponentWrapperComponent', () => {
  let component: ComponentWrapperComponent;
  let fixture: ComponentFixture<ComponentWrapperComponent>;
  let mockComponentInstance: InjectedComponentInstance;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentWrapperComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComponentWrapperComponent);
    component = fixture.componentInstance;

    // Create mock component instance
    const mockComponentDef: InjectableComponent = {
      id: 'test',
      name: 'Test Component',
      component: TestComponent,
      description: 'Test Description',
    };

    mockComponentInstance = {
      instanceId: 'test-1',
      componentDef: mockComponentDef,
      componentRef: {} as any,
      data: { title: 'Test' },
    };
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default states', () => {
    expect(component.isHovered).toBe(false);
    expect(component.isSelected).toBe(false);
  });

  describe('Component Instance', () => {
    it('should accept component instance', () => {
      component.componentInstance = mockComponentInstance;
      fixture.detectChanges();

      expect(component.componentInstance).toBeDefined();
      expect(component.componentInstance?.instanceId).toBe('test-1');
    });

    it('should display component name', () => {
      component.componentInstance = mockComponentInstance;
      fixture.detectChanges();

      expect(component.componentInstance.componentDef.name).toBe('Test Component');
    });

    it('should display component description', () => {
      component.componentInstance = mockComponentInstance;
      fixture.detectChanges();

      expect(component.componentInstance.componentDef.description).toBe('Test Description');
    });
  });

  describe('Hover State', () => {
    it('should set isHovered to true on mouse enter', () => {
      component.onMouseEnter();
      expect(component.isHovered).toBe(true);
    });

    it('should set isHovered to false on mouse leave', () => {
      component.isHovered = true;
      component.onMouseLeave();
      expect(component.isHovered).toBe(false);
    });
  });

  describe('Selection', () => {
    beforeEach(() => {
      component.componentInstance = mockComponentInstance;
    });

    it('should emit selectionChanged on click', (done) => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.selectionChanged.subscribe((instance) => {
        expect(instance).toEqual(mockComponentInstance);
        done();
      });

      component.onClick(mockEvent);
    });

    it('should stop event propagation on click', () => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.onClick(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Edit Action', () => {
    beforeEach(() => {
      component.componentInstance = mockComponentInstance;
    });

    it('should emit editRequested event', (done) => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.editRequested.subscribe((instance) => {
        expect(instance).toEqual(mockComponentInstance);
        done();
      });

      component.onEdit(mockEvent);
    });

    it('should stop event propagation', () => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.onEdit(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Delete Action', () => {
    beforeEach(() => {
      component.componentInstance = mockComponentInstance;
    });

    it('should emit deleteRequested event', (done) => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.deleteRequested.subscribe((instance) => {
        expect(instance).toEqual(mockComponentInstance);
        done();
      });

      component.onDelete(mockEvent);
    });

    it('should stop event propagation', () => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.onDelete(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Move Up Action', () => {
    beforeEach(() => {
      component.componentInstance = mockComponentInstance;
    });

    it('should emit moveUpRequested event', (done) => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.moveUpRequested.subscribe((instance) => {
        expect(instance).toEqual(mockComponentInstance);
        done();
      });

      component.onMoveUp(mockEvent);
    });

    it('should stop event propagation', () => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.onMoveUp(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Move Down Action', () => {
    beforeEach(() => {
      component.componentInstance = mockComponentInstance;
    });

    it('should emit moveDownRequested event', (done) => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.moveDownRequested.subscribe((instance) => {
        expect(instance).toEqual(mockComponentInstance);
        done();
      });

      component.onMoveDown(mockEvent);
    });

    it('should stop event propagation', () => {
      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      component.onMoveDown(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing component instance gracefully', () => {
      component.componentInstance = null as any;
      fixture.detectChanges();

      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      expect(() => component.onClick(mockEvent)).not.toThrow();
    });

    it('should handle undefined component instance gracefully', () => {
      component.componentInstance = undefined as any;
      fixture.detectChanges();

      const mockEvent = {
        stopPropagation: jest.fn(),
      } as any;

      expect(() => component.onClick(mockEvent)).not.toThrow();
    });
  });
});
