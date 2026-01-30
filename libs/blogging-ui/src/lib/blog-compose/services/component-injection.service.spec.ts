import { TestBed } from '@angular/core/testing';
import { ComponentInjectionService } from './component-injection.service';
import { Component, ComponentRef, ViewContainerRef, ViewRef, EventEmitter } from '@angular/core';
import { ComponentWrapperComponent } from '../components/component-wrapper.component';
import { InjectableComponent, InjectedComponentInstance } from '../interfaces/component-injection.interface';

// Helper to replace jasmine.createSpyObj
function createSpyObj(baseName: string, methodNames: string[]) {
  const obj: any = {};
  for (const method of methodNames) {
    obj[method] = jest.fn();
  }
  return obj;
}

@Component({
  selector: 'lib-test-component',
  template: '',
  standalone: true
})
class TestComponent {
  title = '';
  content = '';
}

describe('ComponentInjectionService', () => {
  let service: ComponentInjectionService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let viewContainerRefSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let componentRefSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapperRefSpy: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let wrapperInstanceSpy: any;
  let testComponent: TestComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ComponentInjectionService]
    });
    service = TestBed.inject(ComponentInjectionService);

    // Mock ViewContainerRef
    viewContainerRefSpy = createSpyObj('ViewContainerRef', ['createComponent', 'indexOf', 'move']);
    
    // Mock ComponentRef for the actual component
    testComponent = new TestComponent();
    componentRefSpy = createSpyObj('ComponentRef', ['destroy']);
    componentRefSpy.instance = testComponent;
    componentRefSpy.location = { nativeElement: document.createElement('div') };
    componentRefSpy.changeDetectorRef = { detectChanges: jest.fn() };
    componentRefSpy.hostView = {} as ViewRef;

    // Mock wrapper instance events
    wrapperInstanceSpy = createSpyObj('ComponentWrapperComponent', []);
    wrapperInstanceSpy.editRequested = new EventEmitter();
    wrapperInstanceSpy.deleteRequested = new EventEmitter();
    wrapperInstanceSpy.moveUpRequested = new EventEmitter();
    wrapperInstanceSpy.moveDownRequested = new EventEmitter();
    wrapperInstanceSpy.selectionChanged = new EventEmitter();
    wrapperInstanceSpy.componentInstance = undefined;

    // Mock ComponentRef for the wrapper
    wrapperRefSpy = createSpyObj('ComponentRef', ['destroy']);
    wrapperRefSpy.instance = wrapperInstanceSpy;
    wrapperRefSpy.location = { nativeElement: document.createElement('div') };
    wrapperRefSpy.hostView = {} as ViewRef;
    wrapperRefSpy.changeDetectorRef = { detectChanges: jest.fn() };
    
    // Setup default createComponent behavior
    viewContainerRefSpy.createComponent.mockImplementation((componentType: any) => {
        if (componentType === ComponentWrapperComponent) {
            return wrapperRefSpy;
        }
        return componentRefSpy;
    });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Component Registration', () => {
    it('should register a component', () => {
      const component: InjectableComponent = {
        id: 'test',
        name: 'Test',
        component: TestComponent,
        category: 'Test',
        description: 'Test Component',
        icon: 'code'
      };
      
      service.registerComponent(component);
      const registered = service.getRegisteredComponents();
      
      expect(registered.length).toBe(1);
      expect(registered[0]).toEqual(component);
    });

    it('should get components by category', () => {
      service.registerComponent({
        id: 'test1', name: 'Test 1', component: TestComponent, category: 'Cat1',
        description: '',
        icon: ''
      });
      service.registerComponent({
        id: 'test2', name: 'Test 2', component: TestComponent, category: 'Cat2',
        description: '',
        icon: ''
      });
      
      const cat1 = service.getComponentsByCategory('Cat1');
      expect(cat1.length).toBe(1);
      expect(cat1[0].id).toBe('test1');
    });

    it('should unregister a component and remove active instances', async () => {
      const component: InjectableComponent = {
        id: 'test',
        name: 'Test',
        component: TestComponent,
        category: 'Test',
        description: '',
        icon: ''
      };
      
      service.setViewContainer(viewContainerRefSpy);
      service.registerComponent(component);
      
      await service.injectComponent('test');
      
      expect(service.getActiveComponents().length).toBe(1);
      
      service.unregisterComponent('test');
      
      expect(service.getRegisteredComponents().length).toBe(0);
      expect(service.getActiveComponents().length).toBe(0);
    });
  });

  describe('Component Injection', () => {
    const testComponentDef: InjectableComponent = {
      id: 'test',
      name: 'Test',
      component: TestComponent,
      category: 'Test',
      description: '',
      icon: '',
      data: { title: 'Default' }
    };

    beforeEach(() => {
      service.registerComponent(testComponentDef);
      service.setViewContainer(viewContainerRefSpy);
    });

    it('should throw if view container is not set', async () => {
      const newService = new ComponentInjectionService();
      newService.registerComponent(testComponentDef);
      
      await expect(newService.injectComponent('test')).rejects.toThrow(/ViewContainer not set/);
    });

    it('should throw if component not found', async () => {
      await expect(service.injectComponent('unknown')).rejects.toThrow(/not found/);
    });

    it('should inject component and return instance', async () => {
      const instance = await service.injectComponent('test', { title: 'New Title' });
      
      expect(instance).toBeDefined();
      expect(instance.componentDef.id).toBe('test');
      expect(instance.data['title']).toBe('New Title');
      expect(viewContainerRefSpy.createComponent).toHaveBeenCalledTimes(2);
      expect(service.getActiveComponents().length).toBe(1);
    });

    it('should set initial data correctly', async () => {
      await service.injectComponent('test', { title: 'Custom Title', content: 'Content' });
      
      expect(testComponent.title).toBe('Custom Title');
      expect(testComponent.content).toBe('Content');
    });

    it('should emit added event', async () => {
      jest.spyOn(service.componentEvents, 'emit');
      await service.injectComponent('test');
      
      expect(service.componentEvents.emit).toHaveBeenCalledWith(expect.objectContaining({
        type: 'added'
      }));
    });
  });

  describe('renderComponentInto', () => {
    const testComponentDef: InjectableComponent = {
        id: 'test',
        name: 'Test',
        component: TestComponent,
        category: 'Test',
        description: '',
        icon: ''
    };

    beforeEach(() => {
        service.registerComponent(testComponentDef);
        service.setViewContainer(viewContainerRefSpy);
    });

    it('should render component into target element', () => {
        const targetElement = document.createElement('div');
        const instance = service.renderComponentInto('test', 'inst-1', {}, targetElement);

        expect(instance).toBeDefined();
        expect(viewContainerRefSpy.createComponent).toHaveBeenCalled();
        expect(targetElement.children.length).toBeGreaterThan(0);
    });
  });

  describe('Instance Management', () => {
    const testComponentDef: InjectableComponent = {
        id: 'test',
        name: 'Test',
        component: TestComponent,
        category: 'Test',
        description: '',
        icon: ''
    };

    let instance: InjectedComponentInstance;

    beforeEach(async () => {
        service.registerComponent(testComponentDef);
        service.setViewContainer(viewContainerRefSpy);
        instance = await service.injectComponent('test');
    });

    it('should get instance by id', () => {
        const retrieved = service.getInstance(instance.instanceId);
        expect(retrieved).toBe(instance);
    });

    it('should remove component', () => {
        service.removeComponent(instance.instanceId);
        expect(service.getActiveComponents().length).toBe(0);
        expect(wrapperRefSpy.destroy).toHaveBeenCalled();
    });

    it('should update component', () => {
        service.updateComponent(instance.instanceId, { title: 'Updated' });
        
        expect(instance.data['title']).toBe('Updated');
        
        // Check inner component update
        expect(testComponent.title).toBe('Updated');
    });

    it('should clear all components', () => {
        service.clearAllComponents();
        expect(service.getActiveComponents().length).toBe(0);
    });
    
    it('should move component', () => {
        viewContainerRefSpy.indexOf.mockReturnValue(0);
        
        service.moveComponent(instance.instanceId, 1);
        
        expect(viewContainerRefSpy.move).toHaveBeenCalled();
        expect(instance.position?.index).toBe(1);
    });
  });
  
  describe('Wrapper Callbacks', () => {
    it('should execute callbacks when wrapper emits events', async () => {
        const callbacks = {
            onEdit: jest.fn(),
            onDelete: jest.fn(),
            onMoveUp: jest.fn(),
            onMoveDown: jest.fn(),
            onSelection: jest.fn()
        };
        
        service.setWrapperCallbacks(callbacks);
        service.registerComponent({ id: 'test', name: 'Test', component: TestComponent, category: '', description: '', icon: '' });
        service.setViewContainer(viewContainerRefSpy);
        
        await service.injectComponent('test');
        
        // Emit events from the mock wrapper
        wrapperInstanceSpy.editRequested.emit({} as any);
        expect(callbacks.onEdit).toHaveBeenCalled();

        wrapperInstanceSpy.deleteRequested.emit({} as any);
        expect(callbacks.onDelete).toHaveBeenCalled();
        
        wrapperInstanceSpy.moveUpRequested.emit({} as any);
        expect(callbacks.onMoveUp).toHaveBeenCalled();
        
        wrapperInstanceSpy.moveDownRequested.emit({} as any);
        expect(callbacks.onMoveDown).toHaveBeenCalled();
        
        wrapperInstanceSpy.selectionChanged.emit({} as any);
        expect(callbacks.onSelection).toHaveBeenCalled();
    });
  });
});
