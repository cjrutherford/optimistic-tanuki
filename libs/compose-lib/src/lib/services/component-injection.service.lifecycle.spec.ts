import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  Component,
  ComponentRef,
  ViewChild,
  ViewContainerRef,
} from '@angular/core';
import { ComponentInjectionService } from './component-injection.service';
import { ComponentWrapperComponent } from '../components/component-wrapper.component';
import {
  ComponentInjectionEvent,
  InjectableComponent,
} from '../interfaces/component-injection.interface';

@Component({
  selector: 'lib-injectable-test',
  template: '<div class="injectable-test">{{ title }}</div>',
  standalone: true,
})
class InjectableTestComponent {
  title = 'default title';
  count = 0;
}

@Component({
  selector: 'lib-injection-host',
  template: '<ng-container #vc></ng-container>',
  standalone: true,
})
class InjectionHostComponent {
  @ViewChild('vc', { read: ViewContainerRef, static: true })
  vc!: ViewContainerRef;
}

/**
 * The registry-only spec next to this one mocks ViewContainerRef, so its
 * createComponent returns undefined and none of the injection paths can run.
 * These drive the service through a real ViewContainerRef instead.
 */
describe('ComponentInjectionService injection lifecycle', () => {
  let service: ComponentInjectionService;
  let fixture: ComponentFixture<InjectionHostComponent>;
  let events: ComponentInjectionEvent[];

  const definition: InjectableComponent = {
    id: 'test-widget',
    name: 'Test Widget',
    component: InjectableTestComponent,
    category: 'Test',
    data: { title: 'from definition' },
  };

  /** The service stashes the inner component ref on the instance data. */
  const innerRefOf = (data: Record<string, unknown> | undefined) =>
    data?.['_innerComponentRef'] as ComponentRef<InjectableTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InjectionHostComponent, InjectableTestComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(InjectionHostComponent);
    fixture.detectChanges();

    service = TestBed.inject(ComponentInjectionService);
    service.setViewContainer(fixture.componentInstance.vc);
    service.registerComponent(definition);

    events = [];
    service.componentEvents.subscribe((event) => events.push(event));
  });

  describe('injectComponent', () => {
    it('rejects when no view container has been set', async () => {
      const bare = new ComponentInjectionService();
      bare.registerComponent(definition);

      await expect(bare.injectComponent('test-widget')).rejects.toThrow(
        'ViewContainer not set. Call setViewContainer first.'
      );
    });

    it('rejects for an unregistered component id', async () => {
      await expect(service.injectComponent('missing-widget')).rejects.toThrow(
        "Component with id 'missing-widget' not found."
      );
    });

    it('registers the instance and emits an added event', async () => {
      const instance = await service.injectComponent('test-widget');

      expect(instance.instanceId.startsWith('test-widget_')).toBe(true);
      expect(instance.componentDef).toBe(definition);
      expect(service.getInstance(instance.instanceId)).toBe(instance);
      expect(service.getComponent(instance.instanceId)).toBe(instance);
      expect(service.getActiveComponents()).toEqual([instance]);
      expect(events).toHaveLength(1);
      // Identity, not toMatchObject: the instance holds a ComponentRef whose
      // object graph is circular, and deep matching it overflows the stack.
      expect(events[0].type).toBe('added');
      expect(events[0].instance).toBe(instance);
    });

    it('merges call data over definition data onto the inner component', async () => {
      const instance = await service.injectComponent('test-widget', {
        title: 'overridden',
      });

      expect(instance.data).toMatchObject({ title: 'overridden' });
      expect(innerRefOf(instance.data).instance.title).toBe('overridden');
    });

    it('falls back to the definition data when no call data is given', async () => {
      const instance = await service.injectComponent('test-widget');

      expect(innerRefOf(instance.data).instance.title).toBe('from definition');
    });

    it('skips keys the component does not declare', async () => {
      const instance = await service.injectComponent('test-widget', {
        notAProperty: 'ignored',
      });

      const inner = innerRefOf(instance.data).instance as unknown as Record<
        string,
        unknown
      >;
      expect(inner['notAProperty']).toBeUndefined();
      // ...while still recording it on the instance data.
      expect(instance.data).toMatchObject({ notAProperty: 'ignored' });
    });

    it('nests the component element inside the wrapper element', async () => {
      const instance = await service.injectComponent('test-widget');

      const wrapperEl = instance.componentRef.location
        .nativeElement as HTMLElement;
      expect(wrapperEl.querySelector('.injectable-test')).not.toBeNull();
    });

    // DEFECT PINNED, NOT DESIRED BEHAVIOUR. injectComponent re-parents the
    // component's DOM node into the wrapper element, which moves it out of the
    // ViewContainerRef's anchor region. The subsequent ViewContainerRef.move()
    // then cannot find the node where Angular expects it and throws. Passing a
    // position to injectComponent therefore always fails. Update this test when
    // the service is fixed.
    it('throws when a position is requested (known defect)', async () => {
      await expect(
        service.injectComponent('test-widget', undefined, 0)
      ).rejects.toThrow(/child can not be found/i);
    });

    it('leaves the position unset when none is requested', async () => {
      const instance = await service.injectComponent('test-widget');
      expect(instance.position).toBeUndefined();
    });

    it('routes wrapper outputs to the registered callbacks', async () => {
      const callbacks = {
        onEdit: jest.fn(),
        onDelete: jest.fn(),
        onMoveUp: jest.fn(),
        onMoveDown: jest.fn(),
        onSelection: jest.fn(),
      };
      service.setWrapperCallbacks(callbacks);

      const instance = await service.injectComponent('test-widget');
      const wrapper = instance.componentRef
        .instance as ComponentWrapperComponent;

      wrapper.editRequested.emit(instance);
      wrapper.deleteRequested.emit(instance);
      wrapper.moveUpRequested.emit(instance);
      wrapper.moveDownRequested.emit(instance);
      wrapper.selectionChanged.emit(instance);

      expect(callbacks.onEdit).toHaveBeenCalledWith(instance);
      expect(callbacks.onDelete).toHaveBeenCalledWith(instance);
      expect(callbacks.onMoveUp).toHaveBeenCalledWith(instance);
      expect(callbacks.onMoveDown).toHaveBeenCalledWith(instance);
      expect(callbacks.onSelection).toHaveBeenCalledWith(instance);
    });

    it('tolerates wrapper outputs firing with no callbacks registered', async () => {
      const instance = await service.injectComponent('test-widget');
      const wrapper = instance.componentRef
        .instance as ComponentWrapperComponent;

      expect(() => wrapper.editRequested.emit(instance)).not.toThrow();
      expect(() => wrapper.deleteRequested.emit(instance)).not.toThrow();
    });
  });

  describe('renderComponentInto', () => {
    it('throws when no view container has been set', () => {
      const bare = new ComponentInjectionService();
      bare.registerComponent(definition);

      expect(() =>
        bare.renderComponentInto(
          'test-widget',
          'id-1',
          {},
          document.createElement('div')
        )
      ).toThrow('ViewContainer not set. Call setViewContainer first.');
    });

    it('throws for an unregistered component id', () => {
      expect(() =>
        service.renderComponentInto(
          'missing-widget',
          'id-1',
          {},
          document.createElement('div')
        )
      ).toThrow("Component with id 'missing-widget' not found.");
    });

    it('renders into the supplied target using the caller instance id', () => {
      const target = document.createElement('div');

      const instance = service.renderComponentInto(
        'test-widget',
        'caller-chosen-id',
        { title: 'rendered' },
        target
      );

      expect(instance.instanceId).toBe('caller-chosen-id');
      expect(service.getInstance('caller-chosen-id')).toBe(instance);
      expect(target.querySelector('.injectable-test')).not.toBeNull();
      expect(innerRefOf(instance.data).instance.title).toBe('rendered');
    });

    it('does not emit an added event', () => {
      service.renderComponentInto(
        'test-widget',
        'quiet-id',
        {},
        document.createElement('div')
      );

      expect(events).toHaveLength(0);
    });
  });

  describe('removeComponent', () => {
    it('destroys the wrapper, drops the instance and emits removed', async () => {
      const instance = await service.injectComponent('test-widget');
      const destroySpy = jest.spyOn(instance.componentRef, 'destroy');

      service.removeComponent(instance.instanceId);

      expect(destroySpy).toHaveBeenCalled();
      expect(service.getActiveComponents()).toEqual([]);
      const last = events[events.length - 1];
      expect(last.type).toBe('removed');
      expect(last.instance).toBe(instance);
    });

    it('is a no-op for an unknown instance id', () => {
      expect(() => service.removeComponent('missing')).not.toThrow();
      expect(events).toHaveLength(0);
    });
  });

  describe('updateComponent', () => {
    it('throws for an unknown instance id', () => {
      expect(() => service.updateComponent('missing', {})).toThrow(
        "Component instance 'missing' not found."
      );
    });

    it('merges the new data and emits updated with the previous data', async () => {
      const instance = await service.injectComponent('test-widget', {
        title: 'first',
      });

      service.updateComponent(instance.instanceId, { title: 'second' });

      expect(instance.data).toMatchObject({ title: 'second' });
      const last = events[events.length - 1];
      expect(last.type).toBe('updated');
      expect(last.oldData).toMatchObject({ title: 'first' });
    });

    it('writes declared properties onto the wrapper it holds a ref to', async () => {
      const instance = await service.injectComponent('test-widget');

      service.updateComponent(instance.instanceId, { isSelected: true });

      const wrapper = instance.componentRef
        .instance as ComponentWrapperComponent;
      expect(wrapper.isSelected).toBe(true);
    });
  });

  describe('moveComponent', () => {
    it('throws for an unknown instance id', () => {
      expect(() => service.moveComponent('missing', 1)).toThrow(
        "Component instance 'missing' not found."
      );
    });

    // DEFECT PINNED, NOT DESIRED BEHAVIOUR — same root cause as the
    // injectComponent position case. moveComponentToPosition throws before the
    // position is recorded, so the position is never updated and no 'moved'
    // event is ever emitted. Reordering is entirely non-functional.
    it('throws and emits nothing (known defect)', async () => {
      const instance = await service.injectComponent('test-widget');
      const eventsBefore = events.length;

      expect(() => service.moveComponent(instance.instanceId, 0)).toThrow(
        /child can not be found/i
      );

      expect(instance.position).toBeUndefined();
      expect(events).toHaveLength(eventsBefore);
    });
  });

  describe('unregisterComponent', () => {
    it('also removes active instances of that type', async () => {
      const instance = await service.injectComponent('test-widget');

      service.unregisterComponent('test-widget');

      expect(service.getActiveComponents()).toEqual([]);
      expect(service.getRegisteredComponents()).toEqual([]);
      expect(events.some((e) => e.type === 'removed')).toBe(true);
      expect(service.getInstance(instance.instanceId)).toBeUndefined();
    });
  });

  describe('clearAllComponents', () => {
    it('removes every active instance', async () => {
      await service.injectComponent('test-widget');
      await service.injectComponent('test-widget');
      expect(service.getActiveComponents()).toHaveLength(2);

      service.clearAllComponents();

      expect(service.getActiveComponents()).toEqual([]);
      expect(events.filter((e) => e.type === 'removed')).toHaveLength(2);
    });
  });
});
