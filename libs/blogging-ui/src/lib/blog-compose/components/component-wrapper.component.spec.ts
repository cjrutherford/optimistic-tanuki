import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentWrapperComponent } from './component-wrapper.component';
import { InjectedComponentInstance } from '../interfaces/component-injection.interface';
import { Component, ComponentRef } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'mat-icon',
  standalone: true,
  template: ''
})
class MockMatIconComponent {}

describe('ComponentWrapperComponent', () => {
  let component: ComponentWrapperComponent;
  let fixture: ComponentFixture<ComponentWrapperComponent>;

  const mockComponentInstance: InjectedComponentInstance = {
    instanceId: 'test-id',
    componentDef: {
      id: 'test',
      name: 'Test Component',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      component: {} as any,
      category: 'Test',
      description: '',
      icon: ''
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    componentRef: {} as ComponentRef<any>,
    data: {}
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComponentWrapperComponent]
    })
    .overrideComponent(ComponentWrapperComponent, {
      remove: { imports: [MatIconModule] }, 
      add: { imports: [MockMatIconComponent] }
    })
    .compileComponents();

    fixture = TestBed.createComponent(ComponentWrapperComponent);
    component = fixture.componentInstance;
    component.componentInstance = mockComponentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Mouse Interactions', () => {
    it('should set isHovered on mouse enter', () => {
      component.onMouseEnter();
      expect(component.isHovered).toBe(true);
    });

    it('should unset isHovered on mouse leave', () => {
      component.onMouseEnter();
      component.onMouseLeave();
      expect(component.isHovered).toBe(false);
    });
  });

  describe('Actions', () => {
    it('should emit selectionChanged on click', () => {
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');
      jest.spyOn(component.selectionChanged, 'emit');
      
      component.onClick(event);
      
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.selectionChanged.emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('should emit editRequested on edit', () => {
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');
      jest.spyOn(component.editRequested, 'emit');
      
      component.onEdit(event);
      
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.editRequested.emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('should emit deleteRequested on delete', () => {
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');
      jest.spyOn(component.deleteRequested, 'emit');
      
      component.onDelete(event);
      
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.deleteRequested.emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('should emit moveUpRequested on move up', () => {
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');
      jest.spyOn(component.moveUpRequested, 'emit');
      
      component.onMoveUp(event);
      
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.moveUpRequested.emit).toHaveBeenCalledWith(mockComponentInstance);
    });

    it('should emit moveDownRequested on move down', () => {
      const event = new Event('click');
      jest.spyOn(event, 'stopPropagation');
      jest.spyOn(component.moveDownRequested, 'emit');
      
      component.onMoveDown(event);
      
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(component.moveDownRequested.emit).toHaveBeenCalledWith(mockComponentInstance);
    });
  });
});
