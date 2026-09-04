import { TestBed } from '@angular/core/testing';
import {
  Component,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
} from '@angular/core';
import { ComponentInjectionService } from './component-injection.service';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionEvent,
} from '../interfaces/component-injection.interface';
import { ComponentEditorWrapperComponent } from '@optimistic-tanuki/compose-lib';
import { CalloutBoxComponent } from '../components/example-components/callout-box.component';

@Component({
  selector: 'lib-injection-host',
  standalone: true,
  template: '<ng-container #host></ng-container>',
})
class InjectionHostComponent {
  @ViewChild('host', { read: ViewContainerRef, static: true })
  host!: ViewContainerRef;
}

const calloutDef: InjectableComponent = {
  id: 'callout-box',
  name: 'Callout Box',
  component: CalloutBoxComponent,
  category: 'Social',
  data: { type: 'info', title: 'Default title' },
};

describe('ComponentInjectionService', () => {
  let service: ComponentInjectionService;
  let viewContainer: ViewContainerRef;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [InjectionHostComponent],
      providers: [ComponentInjectionService],
    });

    const fixture = TestBed.createComponent(InjectionHostComponent);
    viewContainer = fixture.componentInstance.host;
    service = TestBed.inject(ComponentInjectionService);
  });

  describe('registration', () => {
    it('returns registered components and filters them by category', () => {
      service.registerComponent(calloutDef);
      service.registerComponent({
        id: 'code-snippet',
        name: 'Code Snippet',
        component: CalloutBoxComponent,
        category: 'Dev',
      });

      expect(service.getRegisteredComponents().map((c) => c.id)).toEqual([
        'callout-box',
        'code-snippet',
      ]);
      expect(service.getComponentsByCategory('Social')).toEqual([calloutDef]);
      expect(service.getComponentsByCategory('Nope')).toEqual([]);
    });

    it('replaces a registration that reuses an existing id', () => {
      service.registerComponent(calloutDef);
      const replacement = { ...calloutDef, name: 'Renamed' };
      service.registerComponent(replacement);

      expect(service.getRegisteredComponents()).toEqual([replacement]);
    });

    it('destroys active instances of a component type when unregistering it', async () => {
      service.setViewContainer(viewContainer);
      service.registerComponent(calloutDef);

      const instance = await service.injectComponent('callout-box');
      const destroySpy = jest.spyOn(instance.componentRef, 'destroy');

      service.unregisterComponent('callout-box');

      expect(destroySpy).toHaveBeenCalled();
      expect(service.getActiveComponents()).toEqual([]);
      expect(service.getRegisteredComponents()).toEqual([]);
    });
  });

  describe('injectComponent', () => {
    beforeEach(() => {
      service.registerComponent(calloutDef);
    });

    it('throws when the view container has not been set', async () => {
      await expect(service.injectComponent('callout-box')).rejects.toThrow(
        'ViewContainer not set. Call setViewContainer first.'
      );
    });

    it('throws for an unregistered component id', async () => {
      service.setViewContainer(viewContainer);

      await expect(service.injectComponent('nope')).rejects.toThrow(
        "Component with id 'nope' not found."
      );
    });

    it('merges the definition data with the supplied data and configures the wrapper', async () => {
      service.setViewContainer(viewContainer);

      const instance = await service.injectComponent('callout-box', {
        title: 'Overridden',
      });

      expect(instance.data).toEqual({ type: 'info', title: 'Overridden' });
      expect(instance.instanceId).toMatch(/^callout-box_\d+_/);
      expect(instance.position).toBeUndefined();

      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;
      expect(wrapper.componentDef).toBe(calloutDef);
      expect(wrapper.componentInstance).toBe(instance);
      expect(wrapper.componentData).toEqual({
        type: 'info',
        title: 'Overridden',
      });
      expect(service.getInstance(instance.instanceId)).toBe(instance);
    });

    it('records the requested index as the instance position', async () => {
      service.setViewContainer(viewContainer);
      const createSpy = jest.spyOn(viewContainer, 'createComponent');

      const instance = await service.injectComponent('callout-box', {}, 0);

      expect(instance.position).toEqual({ index: 0 });
      expect(createSpy).toHaveBeenCalledWith(ComponentEditorWrapperComponent, {
        index: 0,
      });
    });

    it('emits an added event carrying the new instance', async () => {
      service.setViewContainer(viewContainer);
      const events: ComponentInjectionEvent[] = [];
      service.componentEvents.subscribe((e) => events.push(e));

      const instance = await service.injectComponent('callout-box');

      expect(events).toEqual([{ type: 'added', instance }]);
    });

    it('routes wrapper outputs to the registered callbacks', async () => {
      service.setViewContainer(viewContainer);
      const onDelete = jest.fn();
      const onDuplicate = jest.fn();
      const onSelection = jest.fn();
      const onPropertiesChanged = jest.fn();
      service.setWrapperCallbacks({
        onDelete,
        onDuplicate,
        onSelection,
        onPropertiesChanged,
      });

      const instance = await service.injectComponent('callout-box');
      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;

      wrapper.deleteRequested.emit(instance as never);
      wrapper.duplicateRequested.emit(instance as never);
      wrapper.selectionChanged.emit(instance as never);
      wrapper.propertiesChanged.emit({
        instance,
        data: { title: 'x' },
      } as never);

      expect(onDelete).toHaveBeenCalledWith(instance);
      expect(onDuplicate).toHaveBeenCalledWith(instance);
      expect(onSelection).toHaveBeenCalledWith(instance);
      expect(onPropertiesChanged).toHaveBeenCalledWith({
        instance,
        data: { title: 'x' },
      });
    });

    it('does not throw when wrapper outputs fire with no callbacks registered', async () => {
      service.setViewContainer(viewContainer);
      const instance = await service.injectComponent('callout-box');
      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;

      expect(() =>
        wrapper.deleteRequested.emit(instance as never)
      ).not.toThrow();
    });
  });

  describe('renderComponentInto', () => {
    let target: HTMLElement;

    beforeEach(() => {
      service.registerComponent(calloutDef);
      target = document.createElement('div');
    });

    it('throws when the view container has not been set', () => {
      expect(() =>
        service.renderComponentInto('callout-box', 'inst-1', {}, target)
      ).toThrow('ViewContainer not set. Call setViewContainer first.');
    });

    it('throws for an unregistered component id', () => {
      service.setViewContainer(viewContainer);

      expect(() =>
        service.renderComponentInto('nope', 'inst-1', {}, target)
      ).toThrow("Component with id 'nope' not found.");
    });

    it('appends the wrapper element into the target and stores the instance', () => {
      service.setViewContainer(viewContainer);

      const instance = service.renderComponentInto(
        'callout-box',
        'inst-1',
        { title: 'Rendered' },
        target
      );

      expect(instance.instanceId).toBe('inst-1');
      expect(instance.data).toEqual({ type: 'info', title: 'Rendered' });
      expect(target.children).toHaveLength(1);
      expect(target.firstElementChild).toBe(
        instance.componentRef.location.nativeElement
      );
      expect(service.getComponent('inst-1')).toBe(instance);
    });

    it('routes wrapper outputs from rendered instances to the callbacks', () => {
      service.setViewContainer(viewContainer);
      const onDelete = jest.fn();
      const onSelection = jest.fn();
      service.setWrapperCallbacks({ onDelete, onSelection });

      const instance = service.renderComponentInto(
        'callout-box',
        'inst-1',
        {},
        target
      );
      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;

      wrapper.deleteRequested.emit(instance as never);
      wrapper.selectionChanged.emit(instance as never);

      expect(onDelete).toHaveBeenCalledWith(instance);
      expect(onSelection).toHaveBeenCalledWith(instance);
    });
  });

  describe('removeComponent', () => {
    beforeEach(() => {
      service.setViewContainer(viewContainer);
      service.registerComponent(calloutDef);
    });

    it('destroys the component ref and emits a removed event', async () => {
      const instance = await service.injectComponent('callout-box');
      const destroySpy = jest.spyOn(instance.componentRef, 'destroy');
      const events: ComponentInjectionEvent[] = [];
      service.componentEvents.subscribe((e) => events.push(e));

      service.removeComponent(instance.instanceId);

      expect(destroySpy).toHaveBeenCalled();
      expect(service.getInstance(instance.instanceId)).toBeUndefined();
      expect(events).toEqual([{ type: 'removed', instance }]);
    });

    it('is a no-op for an unknown instance id', () => {
      const events: ComponentInjectionEvent[] = [];
      service.componentEvents.subscribe((e) => events.push(e));

      service.removeComponent('missing');

      expect(events).toEqual([]);
    });
  });

  describe('updateComponent', () => {
    beforeEach(() => {
      service.setViewContainer(viewContainer);
      service.registerComponent(calloutDef);
    });

    it('throws for an unknown instance id', () => {
      expect(() => service.updateComponent('missing', {})).toThrow(
        "Component instance 'missing' not found."
      );
    });

    it('merges data into the instance and forwards it to the wrapper', async () => {
      const instance = await service.injectComponent('callout-box');
      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;
      const updateSpy = jest.spyOn(wrapper, 'updateComponentData');

      service.updateComponent(instance.instanceId, { title: 'Updated' });

      expect(instance.data).toEqual({ type: 'info', title: 'Updated' });
      expect(updateSpy).toHaveBeenCalledWith({ title: 'Updated' });
    });

    it('falls back to assigning componentData when the wrapper has no update method', async () => {
      const instance = await service.injectComponent('callout-box');
      const wrapper = instance.componentRef
        .instance as ComponentEditorWrapperComponent;
      (
        wrapper as unknown as { updateComponentData: unknown }
      ).updateComponentData = undefined;

      service.updateComponent(instance.instanceId, { title: 'Fallback' });

      expect(wrapper.componentData).toEqual({
        type: 'info',
        title: 'Fallback',
      });
    });

    it('emits an updated event carrying the pre-update data', async () => {
      const instance = await service.injectComponent('callout-box');
      const events: ComponentInjectionEvent[] = [];
      service.componentEvents.subscribe((e) => events.push(e));

      service.updateComponent(instance.instanceId, { title: 'Updated' });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('updated');
      expect(events[0].oldData).toEqual({
        type: 'info',
        title: 'Default title',
      });
    });
  });

  describe('moveComponent', () => {
    beforeEach(() => {
      service.setViewContainer(viewContainer);
      service.registerComponent(calloutDef);
    });

    it('throws for an unknown instance id', () => {
      expect(() => service.moveComponent('missing', 1)).toThrow(
        "Component instance 'missing' not found."
      );
    });

    it('moves the host view within the container and records the new position', async () => {
      const first = await service.injectComponent('callout-box');
      const second = await service.injectComponent('callout-box');
      const moveSpy = jest.spyOn(viewContainer, 'move');

      service.moveComponent(second.instanceId, 0);

      expect(moveSpy).toHaveBeenCalledWith(second.componentRef.hostView, 0);
      expect(second.position).toEqual({ index: 0 });
      expect(viewContainer.indexOf(first.componentRef.hostView)).toBe(1);
    });

    it('emits a moved event with the new position', async () => {
      const instance = await service.injectComponent('callout-box');
      const events: ComponentInjectionEvent[] = [];
      service.componentEvents.subscribe((e) => events.push(e));

      service.moveComponent(instance.instanceId, 0);

      expect(events).toEqual([{ type: 'moved', instance, newPosition: 0 }]);
    });

    it('skips the container move when the ref is not in the view container', async () => {
      const instance = await service.injectComponent('callout-box');
      const detached: InjectedComponentInstance = {
        ...instance,
        instanceId: 'detached',
        componentRef: {
          hostView: {},
        } as unknown as ComponentRef<unknown>,
      };
      (
        service as unknown as {
          activeComponents: Map<string, InjectedComponentInstance>;
        }
      ).activeComponents.set('detached', detached);
      const moveSpy = jest.spyOn(viewContainer, 'move');

      service.moveComponent('detached', 3);

      expect(moveSpy).not.toHaveBeenCalled();
      expect(detached.position).toEqual({ index: 3 });
    });
  });

  describe('clearAllComponents', () => {
    it('removes every active instance', async () => {
      service.setViewContainer(viewContainer);
      service.registerComponent(calloutDef);
      await service.injectComponent('callout-box');
      await service.injectComponent('callout-box');

      service.clearAllComponents();

      expect(service.getActiveComponents()).toEqual([]);
    });
  });
});
