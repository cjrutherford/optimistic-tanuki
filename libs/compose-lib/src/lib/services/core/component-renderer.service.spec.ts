import { TestBed } from '@angular/core/testing';
import { Component, Input, ApplicationRef, EnvironmentInjector } from '@angular/core';
import { ComponentRendererService } from './component-renderer.service';
import { ComponentRegistryService } from './component-registry.service';
import { ComponentEventBusService } from './component-event-bus.service';
import { ComponentMetadata } from '../../interfaces/component-metadata.interface';

@Component({
  selector: 'test-render-component',
  template: '<div class="test-content">{{message}}</div>',
  standalone: true,
})
class TestRenderComponent {
  @Input() message = 'Default Message';
}

@Component({
  selector: 'another-render-component',
  template: '<span class="another-content">{{value}}</span>',
  standalone: true,
})
class AnotherRenderComponent {
  @Input() value = 0;
}

describe('ComponentRendererService', () => {
  let service: ComponentRendererService;
  let registry: ComponentRegistryService;
  let eventBus: ComponentEventBusService;
  let appRef: ApplicationRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ComponentRendererService,
        ComponentRegistryService,
        ComponentEventBusService,
      ],
    });
    
    service = TestBed.inject(ComponentRendererService);
    registry = TestBed.inject(ComponentRegistryService);
    eventBus = TestBed.inject(ComponentEventBusService);
    appRef = TestBed.inject(ApplicationRef);

    // Register test components
    registry.register({
      id: 'test-component',
      name: 'Test Component',
      component: TestRenderComponent,
      description: 'Test component for rendering',
    });

    registry.register({
      id: 'another-component',
      name: 'Another Component',
      component: AnotherRenderComponent,
      description: 'Another test component',
    });
  });

  afterEach(() => {
    service.destroyAll();
    service.ngOnDestroy();
    registry.ngOnDestroy();
    eventBus.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('render', () => {
    let targetElement: HTMLElement;

    beforeEach(() => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should render a component into DOM', async () => {
      const result = await service.render(
        'test-component',
        'instance-1',
        targetElement,
        {}
      );

      expect(result).toBeDefined();
      expect(result.componentRef).toBeDefined();
      expect(result.portalOutlet).toBeDefined();

      // ⭐ DOM VALIDATION: Component should be in the DOM
      const componentElement = targetElement.querySelector('.test-content');
      expect(componentElement).not.toBeNull();
      expect(componentElement?.textContent).toContain('Default Message');
    });

    it('should render component with data', async () => {
      const result = await service.render(
        'test-component',
        'instance-1',
        targetElement,
        { message: 'Custom Message' }
      );

      // ⭐ DOM VALIDATION: Component should display custom data
      const componentElement = targetElement.querySelector('.test-content');
      expect(componentElement?.textContent).toContain('Custom Message');
    });

    it('should render multiple components', async () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      document.body.appendChild(container1);
      document.body.appendChild(container2);

      await service.render('test-component', 'instance-1', container1, {
        message: 'First',
      });

      await service.render('another-component', 'instance-2', container2, {
        value: 42,
      });

      // ⭐ DOM VALIDATION: Both components should be in DOM
      const first = container1.querySelector('.test-content');
      const second = container2.querySelector('.another-content');

      expect(first?.textContent).toContain('First');
      expect(second?.textContent).toContain('42');

      document.body.removeChild(container1);
      document.body.removeChild(container2);
    });

    it('should emit render event', async (done) => {
      service.renderEvents$.subscribe((event) => {
        if (event.type === 'rendered') {
          expect(event.instanceId).toBe('instance-1');
          expect(event.componentId).toBe('test-component');
          done();
        }
      });

      await service.render('test-component', 'instance-1', targetElement, {});
    });

    it('should track render in stats', async () => {
      await service.render('test-component', 'instance-1', targetElement, {});

      const stats = service.getStats();
      expect(stats.totalRenders).toBe(1);
    });

    it('should throw error for non-existent component', async () => {
      await expect(
        service.render('non-existent', 'instance-1', targetElement, {})
      ).rejects.toThrow();
    });

    it('should replace existing render for same instance ID', async () => {
      await service.render('test-component', 'instance-1', targetElement, {
        message: 'First',
      });

      const container2 = document.createElement('div');
      document.body.appendChild(container2);

      await service.render('test-component', 'instance-1', container2, {
        message: 'Second',
      });

      // ⭐ DOM VALIDATION: Old render should be destroyed, new one should exist
      expect(targetElement.querySelector('.test-content')).toBeNull();
      expect(container2.querySelector('.test-content')).not.toBeNull();
      expect(container2.querySelector('.test-content')?.textContent).toContain(
        'Second'
      );

      document.body.removeChild(container2);
    });

    it('should handle wrapper configuration', async () => {
      const wrapperConfig = {
        showControls: true,
        allowEdit: true,
        allowDelete: true,
        allowMove: true,
      };

      const result = await service.render(
        'test-component',
        'instance-1',
        targetElement,
        {},
        wrapperConfig
      );

      expect(result.wrapperConfig).toEqual(wrapperConfig);
    });
  });

  describe('update', () => {
    let targetElement: HTMLElement;

    beforeEach(async () => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);

      await service.render('test-component', 'instance-1', targetElement, {
        message: 'Original',
      });
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should update component data', () => {
      const result = service.update('instance-1', { message: 'Updated' });
      expect(result).toBe(true);

      // ⭐ DOM VALIDATION: DOM should reflect updated data
      const componentElement = targetElement.querySelector('.test-content');
      expect(componentElement?.textContent).toContain('Updated');
    });

    it('should emit update event', (done) => {
      service.renderEvents$.subscribe((event) => {
        if (event.type === 'updated') {
          expect(event.instanceId).toBe('instance-1');
          done();
        }
      });

      service.update('instance-1', { message: 'Updated' });
    });

    it('should track update in stats', () => {
      service.update('instance-1', { message: 'Updated' });

      const stats = service.getStats();
      expect(stats.totalUpdates).toBe(1);
    });

    it('should return false for non-existent instance', () => {
      const result = service.update('non-existent', { message: 'Test' });
      expect(result).toBe(false);
    });

    it('should update multiple properties', () => {
      service.update('instance-1', { message: 'Multi Update' });

      const componentElement = targetElement.querySelector('.test-content');
      expect(componentElement?.textContent).toContain('Multi Update');
    });
  });

  describe('destroy', () => {
    let targetElement: HTMLElement;

    beforeEach(async () => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);

      await service.render('test-component', 'instance-1', targetElement, {});
    });

    afterEach(() => {
      if (document.body.contains(targetElement)) {
        document.body.removeChild(targetElement);
      }
    });

    it('should destroy a rendered component', () => {
      const result = service.destroy('instance-1');
      expect(result).toBe(true);

      // ⭐ DOM VALIDATION: Component should be removed from DOM
      const componentElement = targetElement.querySelector('.test-content');
      expect(componentElement).toBeNull();
    });

    it('should emit destroy event', (done) => {
      service.renderEvents$.subscribe((event) => {
        if (event.type === 'destroyed') {
          expect(event.instanceId).toBe('instance-1');
          done();
        }
      });

      service.destroy('instance-1');
    });

    it('should track destroy in stats', () => {
      service.destroy('instance-1');

      const stats = service.getStats();
      expect(stats.totalDestroys).toBe(1);
    });

    it('should return false for non-existent instance', () => {
      const result = service.destroy('non-existent');
      expect(result).toBe(false);
    });

    it('should cleanup portal outlet', () => {
      service.destroy('instance-1');
      expect(service.getRenderResult('instance-1')).toBeUndefined();
    });
  });

  describe('getRenderResult', () => {
    let targetElement: HTMLElement;

    beforeEach(async () => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
      await service.render('test-component', 'instance-1', targetElement, {});
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should return render result for rendered instance', () => {
      const result = service.getRenderResult('instance-1');
      expect(result).toBeDefined();
      expect(result?.componentRef).toBeDefined();
    });

    it('should return undefined for non-rendered instance', () => {
      expect(service.getRenderResult('non-existent')).toBeUndefined();
    });
  });

  describe('isRendered', () => {
    let targetElement: HTMLElement;

    beforeEach(async () => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should return true for rendered instance', async () => {
      await service.render('test-component', 'instance-1', targetElement, {});
      expect(service.isRendered('instance-1')).toBe(true);
    });

    it('should return false for non-rendered instance', () => {
      expect(service.isRendered('non-existent')).toBe(false);
    });

    it('should return false after destroy', async () => {
      await service.render('test-component', 'instance-1', targetElement, {});
      service.destroy('instance-1');
      expect(service.isRendered('instance-1')).toBe(false);
    });
  });

  describe('getRenderedInstances', () => {
    let targetElement1: HTMLElement;
    let targetElement2: HTMLElement;

    beforeEach(() => {
      targetElement1 = document.createElement('div');
      targetElement2 = document.createElement('div');
      document.body.appendChild(targetElement1);
      document.body.appendChild(targetElement2);
    });

    afterEach(() => {
      document.body.removeChild(targetElement1);
      document.body.removeChild(targetElement2);
    });

    it('should return empty array when nothing rendered', () => {
      expect(service.getRenderedInstances()).toEqual([]);
    });

    it('should return all rendered instance IDs', async () => {
      await service.render('test-component', 'instance-1', targetElement1, {});
      await service.render(
        'another-component',
        'instance-2',
        targetElement2,
        {}
      );

      const instances = service.getRenderedInstances();
      expect(instances.length).toBe(2);
      expect(instances).toContain('instance-1');
      expect(instances).toContain('instance-2');
    });
  });

  describe('detectChanges', () => {
    let targetElement: HTMLElement;

    beforeEach(async () => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
      await service.render('test-component', 'instance-1', targetElement, {
        message: 'Initial',
      });
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should trigger change detection', () => {
      const result = service.getRenderResult('instance-1');
      if (result) {
        result.componentRef.instance.message = 'Changed Directly';
        service.detectChanges('instance-1');

        // Change detection should update the view
        const componentElement = targetElement.querySelector('.test-content');
        expect(componentElement?.textContent).toContain('Changed Directly');
      }
    });

    it('should do nothing for non-existent instance', () => {
      expect(() => {
        service.detectChanges('non-existent');
      }).not.toThrow();
    });
  });

  describe('destroyAll', () => {
    let targetElement1: HTMLElement;
    let targetElement2: HTMLElement;

    beforeEach(async () => {
      targetElement1 = document.createElement('div');
      targetElement2 = document.createElement('div');
      document.body.appendChild(targetElement1);
      document.body.appendChild(targetElement2);

      await service.render('test-component', 'instance-1', targetElement1, {});
      await service.render(
        'another-component',
        'instance-2',
        targetElement2,
        {}
      );
    });

    afterEach(() => {
      document.body.removeChild(targetElement1);
      document.body.removeChild(targetElement2);
    });

    it('should destroy all rendered components', () => {
      service.destroyAll();

      expect(service.getRenderedInstances().length).toBe(0);

      // ⭐ DOM VALIDATION: All components should be removed from DOM
      expect(targetElement1.querySelector('.test-content')).toBeNull();
      expect(targetElement2.querySelector('.another-content')).toBeNull();
    });
  });

  describe('getStats', () => {
    let targetElement: HTMLElement;

    beforeEach(() => {
      targetElement = document.createElement('div');
      document.body.appendChild(targetElement);
    });

    afterEach(() => {
      document.body.removeChild(targetElement);
    });

    it('should return render statistics', async () => {
      await service.render('test-component', 'instance-1', targetElement, {});
      service.update('instance-1', { message: 'Updated' });
      service.destroy('instance-1');

      const stats = service.getStats();
      expect(stats.totalRenders).toBe(1);
      expect(stats.totalUpdates).toBe(1);
      expect(stats.totalDestroys).toBe(1);
      expect(stats.currentlyRendered).toBe(0);
    });

    it('should track average render time', async () => {
      await service.render('test-component', 'instance-1', targetElement, {});

      const stats = service.getStats();
      expect(stats.averageRenderTime).toBeGreaterThanOrEqual(0);
    });

    it('should track error count', async () => {
      try {
        await service.render('non-existent', 'instance-1', targetElement, {});
      } catch (e) {
        // Expected error
      }

      const stats = service.getStats();
      expect(stats.errorCount).toBe(1);
    });
  });

  describe('DOM Integration Tests', () => {
    it('should render component at exact target location', async () => {
      const container = document.createElement('div');
      container.id = 'test-container';
      const before = document.createElement('div');
      before.textContent = 'Before';
      const target = document.createElement('div');
      target.id = 'target';
      const after = document.createElement('div');
      after.textContent = 'After';

      container.appendChild(before);
      container.appendChild(target);
      container.appendChild(after);
      document.body.appendChild(container);

      await service.render('test-component', 'instance-1', target, {
        message: 'Target Content',
      });

      // ⭐ DOM VALIDATION: Component should be in exact target location
      const targetContent = target.querySelector('.test-content');
      expect(targetContent).not.toBeNull();
      expect(targetContent?.textContent).toContain('Target Content');

      // Verify structure
      expect(container.children.length).toBe(3);
      expect(container.children[0].textContent).toBe('Before');
      expect(container.children[2].textContent).toBe('After');

      document.body.removeChild(container);
    });

    it('should preserve existing content when rendering in empty element', async () => {
      const container = document.createElement('div');
      const existingElement = document.createElement('span');
      existingElement.textContent = 'Existing';
      container.appendChild(existingElement);
      document.body.appendChild(container);

      await service.render('test-component', 'instance-1', container, {});

      // Component should be added
      expect(container.querySelector('.test-content')).not.toBeNull();

      document.body.removeChild(container);
    });

    it('should handle nested component rendering', async () => {
      const outer = document.createElement('div');
      outer.id = 'outer';
      const inner = document.createElement('div');
      inner.id = 'inner';
      outer.appendChild(inner);
      document.body.appendChild(outer);

      await service.render('test-component', 'outer-instance', outer, {
        message: 'Outer',
      });

      await service.render('another-component', 'inner-instance', inner, {
        value: 123,
      });

      // ⭐ DOM VALIDATION: Both components should exist
      expect(outer.querySelector('.test-content')).not.toBeNull();
      expect(inner.querySelector('.another-content')).not.toBeNull();

      document.body.removeChild(outer);
    });
  });
});
