import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { ComponentStateService } from './component-state.service';
import { ComponentEventBusService } from './component-event-bus.service';
import { ComponentInstance } from '../../interfaces/component-instance.interface';

@Component({
  selector: 'test-component',
  template: '<div>Test</div>',
  standalone: true,
})
class TestComponent {}

describe('ComponentStateService', () => {
  let service: ComponentStateService;
  let eventBus: ComponentEventBusService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ComponentStateService, ComponentEventBusService],
    });
    service = TestBed.inject(ComponentStateService);
    eventBus = TestBed.inject(ComponentEventBusService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    eventBus.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Signal reactivity', () => {
    it('should provide instances signal', () => {
      const instances = service.instances();
      expect(instances).toBeInstanceOf(Map);
      expect(instances.size).toBe(0);
    });

    it('should provide selectedInstanceId signal', () => {
      const selectedId = service.selectedInstanceId();
      expect(selectedId).toBeNull();
    });

    it('should provide isPropertyEditorVisible signal', () => {
      const isVisible = service.isPropertyEditorVisible();
      expect(isVisible).toBe(false);
    });
  });

  describe('add', () => {
    it('should add an instance', () => {
      const instance: ComponentInstance = {
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      service.add(instance);

      expect(service.has('test-1')).toBe(true);
      expect(service.get('test-1')).toEqual(instance);
    });

    it('should update instances signal', () => {
      const instance: ComponentInstance = {
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      service.add(instance);

      const instances = service.instances();
      expect(instances.size).toBe(1);
      expect(instances.get('test-1')).toEqual(instance);
    });

    it('should emit state change event', (done) => {
      service.stateChanges$.subscribe((change) => {
        expect(change.type).toBe('added');
        expect(change.instanceId).toBe('test-1');
        done();
      });

      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should replace existing instance with same ID', () => {
      const instance1: ComponentInstance = {
        id: 'test-1',
        componentId: 'test-component',
        data: { value: 'old' },
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const instance2: ComponentInstance = {
        id: 'test-1',
        componentId: 'test-component',
        data: { value: 'new' },
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      service.add(instance1);
      service.add(instance2);

      const result = service.get('test-1');
      expect(result?.data.value).toBe('new');
    });
  });

  describe('update', () => {
    beforeEach(() => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: { value: 'original' },
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should update an instance', () => {
      const result = service.update('test-1', { state: 'selected' });
      expect(result).toBe(true);

      const instance = service.get('test-1');
      expect(instance?.state).toBe('selected');
    });

    it('should update multiple properties', () => {
      service.update('test-1', {
        state: 'dragging',
        position: { x: 100, y: 200 },
      });

      const instance = service.get('test-1');
      expect(instance?.state).toBe('dragging');
      expect(instance?.position).toEqual({ x: 100, y: 200 });
    });

    it('should update updatedAt timestamp', () => {
      const originalInstance = service.get('test-1');
      const originalTimestamp = originalInstance?.updatedAt || 0;

      // Wait a tiny bit to ensure timestamp changes
      setTimeout(() => {
        service.update('test-1', { state: 'selected' });
        const updatedInstance = service.get('test-1');
        expect(updatedInstance?.updatedAt).toBeGreaterThan(originalTimestamp);
      }, 10);
    });

    it('should return false for non-existent instance', () => {
      const result = service.update('non-existent', { state: 'selected' });
      expect(result).toBe(false);
    });

    it('should emit state change event', (done) => {
      service.stateChanges$.subscribe((change) => {
        if (change.type === 'updated') {
          expect(change.instanceId).toBe('test-1');
          done();
        }
      });

      service.update('test-1', { state: 'selected' });
    });

    it('should maintain immutability', () => {
      const instancesBefore = service.instances();
      service.update('test-1', { state: 'selected' });
      const instancesAfter = service.instances();

      expect(instancesBefore).not.toBe(instancesAfter);
    });
  });

  describe('updateData', () => {
    beforeEach(() => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: { value: 'original', count: 0 },
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should update instance data', () => {
      const result = service.updateData('test-1', { value: 'updated' });
      expect(result).toBe(true);

      const instance = service.get('test-1');
      expect(instance?.data.value).toBe('updated');
      expect(instance?.data.count).toBe(0); // Unchanged
    });

    it('should mark instance as dirty', () => {
      service.updateData('test-1', { value: 'updated' });

      const instance = service.get('test-1');
      expect(instance?.isDirty).toBe(true);
    });

    it('should return false for non-existent instance', () => {
      const result = service.updateData('non-existent', { value: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should remove an instance', () => {
      const result = service.remove('test-1');
      expect(result).toBe(true);
      expect(service.has('test-1')).toBe(false);
    });

    it('should update instances signal', () => {
      service.remove('test-1');
      const instances = service.instances();
      expect(instances.size).toBe(0);
    });

    it('should emit state change event', (done) => {
      service.stateChanges$.subscribe((change) => {
        if (change.type === 'removed') {
          expect(change.instanceId).toBe('test-1');
          done();
        }
      });

      service.remove('test-1');
    });

    it('should clear selection if removed instance was selected', () => {
      service.select('test-1');
      expect(service.selectedInstanceId()).toBe('test-1');

      service.remove('test-1');
      expect(service.selectedInstanceId()).toBeNull();
    });

    it('should return false for non-existent instance', () => {
      const result = service.remove('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent instance', () => {
      expect(service.get('non-existent')).toBeUndefined();
    });

    it('should return existing instance', () => {
      const instance: ComponentInstance = {
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      service.add(instance);
      expect(service.get('test-1')).toEqual(instance);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no instances', () => {
      expect(service.getAll()).toEqual([]);
    });

    it('should return all instances', () => {
      service.add({
        id: 'test-1',
        componentId: 'comp-1',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.add({
        id: 'test-2',
        componentId: 'comp-2',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const all = service.getAll();
      expect(all.length).toBe(2);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      service.add({
        id: 'test-1',
        componentId: 'button',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.add({
        id: 'test-2',
        componentId: 'input',
        data: {},
        state: 'selected',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.add({
        id: 'test-3',
        componentId: 'button',
        data: {},
        state: 'active',
        lifecyclePhase: 'creating',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should filter by componentId', () => {
      const results = service.query({ componentId: 'button' });
      expect(results.instances.length).toBe(2);
      expect(results.count).toBe(2);
    });

    it('should filter by state', () => {
      const results = service.query({ state: 'selected' });
      expect(results.instances.length).toBe(1);
      expect(results.instances[0].id).toBe('test-2');
    });

    it('should filter by lifecyclePhase', () => {
      const results = service.query({ lifecyclePhase: 'rendered' });
      expect(results.instances.length).toBe(2);
    });

    it('should combine multiple filters', () => {
      const results = service.query({
        componentId: 'button',
        lifecyclePhase: 'rendered',
      });
      expect(results.instances.length).toBe(1);
      expect(results.instances[0].id).toBe('test-1');
    });

    it('should use custom filter function', () => {
      const results = service.query({
        filter: (instance) => instance.id.startsWith('test-1'),
      });
      expect(results.instances.length).toBe(1);
      expect(results.instances[0].id).toBe('test-1');
    });
  });

  describe('select', () => {
    beforeEach(() => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it('should select an instance', () => {
      const result = service.select('test-1');
      expect(result).toBe(true);
      expect(service.selectedInstanceId()).toBe('test-1');
    });

    it('should update instance state to selected', () => {
      service.select('test-1');
      const instance = service.get('test-1');
      expect(instance?.state).toBe('selected');
    });

    it('should deselect previously selected instance', () => {
      service.add({
        id: 'test-2',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.select('test-1');
      service.select('test-2');

      const instance1 = service.get('test-1');
      expect(instance1?.state).not.toBe('selected');
      expect(service.selectedInstanceId()).toBe('test-2');
    });

    it('should allow deselection with null', () => {
      service.select('test-1');
      service.select(null);
      expect(service.selectedInstanceId()).toBeNull();
    });

    it('should return false for non-existent instance', () => {
      const result = service.select('non-existent');
      expect(result).toBe(false);
    });

    it('should emit selection event', (done) => {
      eventBus.subscribeToType('component:selected', (event) => {
        expect(event.instanceId).toBe('test-1');
        done();
      });

      service.select('test-1');
    });
  });

  describe('getSelected', () => {
    it('should return undefined when nothing selected', () => {
      expect(service.getSelected()).toBeUndefined();
    });

    it('should return selected instance', () => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.select('test-1');
      const selected = service.getSelected();
      expect(selected?.id).toBe('test-1');
    });
  });

  describe('setPropertyEditorVisible', () => {
    it('should update visibility', () => {
      service.setPropertyEditorVisible(true);
      expect(service.isPropertyEditorVisible()).toBe(true);

      service.setPropertyEditorVisible(false);
      expect(service.isPropertyEditorVisible()).toBe(false);
    });

    it('should emit event', (done) => {
      eventBus.subscribeToType('property-editor:opened', (event) => {
        done();
      });

      service.setPropertyEditorVisible(true);
    });
  });

  describe('getSnapshot', () => {
    it('should return immutable snapshot', () => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.select('test-1');
      service.setPropertyEditorVisible(true);

      const snapshot = service.getSnapshot();
      expect(snapshot.instances.length).toBe(1);
      expect(snapshot.selectedInstanceId).toBe('test-1');
      expect(snapshot.isPropertyEditorVisible).toBe(true);
      expect(snapshot.timestamp).toBeDefined();
    });
  });

  describe('has', () => {
    it('should return false for non-existent instance', () => {
      expect(service.has('non-existent')).toBe(false);
    });

    it('should return true for existing instance', () => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(service.has('test-1')).toBe(true);
    });
  });

  describe('getCount', () => {
    it('should return 0 when no instances', () => {
      expect(service.getCount()).toBe(0);
    });

    it('should return count of instances', () => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      service.add({
        id: 'test-2',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      expect(service.getCount()).toBe(2);
    });
  });

  describe('immutability', () => {
    it('should create new Map on each update', () => {
      service.add({
        id: 'test-1',
        componentId: 'test-component',
        data: {},
        state: 'active',
        lifecyclePhase: 'rendered',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const map1 = service.instances();

      service.update('test-1', { state: 'selected' });

      const map2 = service.instances();

      expect(map1).not.toBe(map2);
    });
  });
});
