/**
 * Component State Service
 * 
 * Manages component instance state using Angular Signals for reactivity.
 * Pure state management with no rendering or registration logic.
 * 
 * @example
 * ```typescript
 * // Add instance
 * stateService.add({
 *   instanceId: 'abc123',
 *   metadata: componentMetadata,
 *   data: { type: 'info' },
 *   state: 'active',
 *   ...
 * });
 * 
 * // Update instance data
 * stateService.updateData('abc123', { title: 'New Title' });
 * 
 * // Select instance
 * stateService.select('abc123');
 * 
 * // Query instances
 * const result = stateService.query({ state: 'active' });
 * 
 * // Reactive access via signals
 * const instances = stateService.instances();
 * const selectedId = stateService.selectedInstanceId();
 * ```
 */

import { Injectable, signal, Signal, computed } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import {
  ComponentInstance,
  ComponentInstanceMap,
  ComponentInstanceQuery,
  ComponentInstanceQueryResult,
  ComponentInstanceState
} from '../../interfaces/component-instance.interface';
import {
  ComponentStateAPI,
  ComponentStateChange,
  ComponentStateSnapshot
} from '../../interfaces/component-state.interface';
import { ComponentData } from '../../types/property-types';
import { ComponentEventBusService } from './component-event-bus.service';

/**
 * Component State Service
 * 
 * Reactive state management for component instances using Angular Signals.
 * All state changes are immutable and tracked via events.
 */
@Injectable({
  providedIn: 'root'
})
export class ComponentStateService implements ComponentStateAPI {
  /**
   * Internal state storage (Signal)
   * @private
   */
  private readonly _instances = signal<Map<string, ComponentInstance>>(new Map());

  /**
   * Selected instance ID (Signal)
   * @private
   */
  private readonly _selectedInstanceId = signal<string | null>(null);

  /**
   * Property editor visibility (Signal)
   * @private
   */
  private readonly _isPropertyEditorVisible = signal<boolean>(false);

  /**
   * State changes subject
   * @private
   */
  private readonly stateChangesSubject = new Subject<ComponentStateChange>();

  /**
   * Public signal: All component instances (reactive)
   * Returns a readonly Map
   */
  readonly instances: Signal<ComponentInstanceMap> = computed(() => {
    return new Map(this._instances()) as ComponentInstanceMap;
  });

  /**
   * Public signal: Currently selected instance ID (reactive)
   */
  readonly selectedInstanceId: Signal<string | null> = this._selectedInstanceId.asReadonly();

  /**
   * Public signal: Property editor visibility (reactive)
   */
  readonly isPropertyEditorVisible: Signal<boolean> = this._isPropertyEditorVisible.asReadonly();

  /**
   * Observable: State changes
   */
  readonly stateChanges$: Observable<ComponentStateChange> = this.stateChangesSubject.asObservable();

  constructor(private readonly eventBus: ComponentEventBusService) {}

  /**
   * Add a new component instance to state
   * 
   * @param instance - Component instance
   */
  add(instance: ComponentInstance): void {
    // Validate instance has required fields
    if (!instance.instanceId || !instance.metadata) {
      console.error('[ComponentState] Invalid instance:', instance);
      return;
    }

    // Check if already exists
    const currentInstances = this._instances();
    if (currentInstances.has(instance.instanceId)) {
      console.warn('[ComponentState] Instance already exists:', instance.instanceId);
      return;
    }

    // Create new map with added instance (immutable update)
    const newInstances = new Map(currentInstances);
    newInstances.set(instance.instanceId, instance);
    this._instances.set(newInstances);

    // Emit state change
    const change: ComponentStateChange = {
      type: 'added',
      instanceId: instance.instanceId,
      newState: instance,
      timestamp: Date.now()
    };
    this.stateChangesSubject.next(change);

    // Publish to event bus
    this.eventBus.publish({
      type: 'component:inserted',
      instanceId: instance.instanceId,
      componentId: instance.metadata.id,
      data: instance.data,
      position: instance.position?.index,
      timestamp: Date.now()
    });
  }

  /**
   * Update an existing component instance
   * 
   * @param instanceId - Instance ID
   * @param updates - Partial instance updates
   * @returns True if updated
   */
  update(instanceId: string, updates: Partial<ComponentInstance>): boolean {
    const currentInstances = this._instances();
    const existingInstance = currentInstances.get(instanceId);

    if (!existingInstance) {
      return false;
    }

    // Create updated instance (immutable)
    const updatedInstance: ComponentInstance = {
      ...existingInstance,
      ...updates,
      updatedAt: Date.now()
    };

    // Create new map with updated instance
    const newInstances = new Map(currentInstances);
    newInstances.set(instanceId, updatedInstance);
    this._instances.set(newInstances);

    // Emit state change
    const change: ComponentStateChange = {
      type: 'updated',
      instanceId,
      previousState: existingInstance,
      newState: updatedInstance,
      timestamp: Date.now()
    };
    this.stateChangesSubject.next(change);

    return true;
  }

  /**
   * Update component data
   * 
   * @param instanceId - Instance ID
   * @param data - New/updated data
   * @returns True if updated
   */
  updateData(instanceId: string, data: Partial<ComponentData>): boolean {
    const currentInstances = this._instances();
    const existingInstance = currentInstances.get(instanceId);

    if (!existingInstance) {
      return false;
    }

    // Merge data (immutable)
    const oldData = existingInstance.data;
    const newData = { ...oldData, ...data };

    // Update instance with new data
    const updatedInstance: ComponentInstance = {
      ...existingInstance,
      data: newData,
      updatedAt: Date.now(),
      isDirty: true
    };

    // Create new map with updated instance
    const newInstances = new Map(currentInstances);
    newInstances.set(instanceId, updatedInstance);
    this._instances.set(newInstances);

    // Emit state change
    const change: ComponentStateChange = {
      type: 'updated',
      instanceId,
      previousState: existingInstance,
      newState: updatedInstance,
      timestamp: Date.now()
    };
    this.stateChangesSubject.next(change);

    // Publish to event bus
    this.eventBus.publish({
      type: 'component:updated',
      instanceId,
      oldData,
      newData,
      changedKeys: Object.keys(data),
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Remove a component instance
   * 
   * @param instanceId - Instance ID
   * @returns True if removed
   */
  remove(instanceId: string): boolean {
    const currentInstances = this._instances();
    const existingInstance = currentInstances.get(instanceId);

    if (!existingInstance) {
      return false;
    }

    // Create new map without instance (immutable)
    const newInstances = new Map(currentInstances);
    newInstances.delete(instanceId);
    this._instances.set(newInstances);

    // Deselect if this was selected
    if (this._selectedInstanceId() === instanceId) {
      this._selectedInstanceId.set(null);
    }

    // Emit state change
    const change: ComponentStateChange = {
      type: 'removed',
      instanceId,
      previousState: existingInstance,
      timestamp: Date.now()
    };
    this.stateChangesSubject.next(change);

    // Publish to event bus
    this.eventBus.publish({
      type: 'component:removed',
      instanceId,
      componentId: existingInstance.metadata.id,
      data: existingInstance.data,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Get a component instance by ID
   * 
   * @param instanceId - Instance ID
   * @returns Instance or undefined
   */
  get(instanceId: string): ComponentInstance | undefined {
    return this._instances().get(instanceId);
  }

  /**
   * Get all component instances
   * 
   * @returns Readonly array of all instances
   */
  getAll(): readonly ComponentInstance[] {
    return Array.from(this._instances().values());
  }

  /**
   * Query component instances
   * 
   * @param query - Query criteria
   * @returns Query result
   */
  query(query: ComponentInstanceQuery): ComponentInstanceQueryResult {
    let instances = this.getAll();

    // Filter by component ID
    if (query.componentId) {
      instances = instances.filter(i => i.metadata.id === query.componentId);
    }

    // Filter by state
    if (query.state) {
      instances = instances.filter(i => i.state === query.state);
    }

    // Filter by selected status
    if (query.isSelected !== undefined) {
      instances = instances.filter(i => i.isSelected === query.isSelected);
    }

    // Filter by dirty status
    if (query.isDirty !== undefined) {
      instances = instances.filter(i => i.isDirty === query.isDirty);
    }

    // Filter by position range
    if (query.positionRange) {
      instances = instances.filter(i => {
        const pos = i.position?.index;
        if (pos === undefined) return false;
        return pos >= query.positionRange!.min && pos <= query.positionRange!.max;
      });
    }

    // Custom filter
    if (query.customFilter) {
      instances = instances.filter(query.customFilter);
    }

    return {
      instances,
      total: instances.length,
      query
    };
  }

  /**
   * Select a component instance
   * 
   * @param instanceId - Instance ID to select (null to deselect all)
   * @returns True if selection changed
   */
  select(instanceId: string | null): boolean {
    const currentSelected = this._selectedInstanceId();

    // No change
    if (currentSelected === instanceId) {
      return false;
    }

    // Deselect previous
    if (currentSelected) {
      this.update(currentSelected, { isSelected: false });
      
      // Emit deselected event
      this.stateChangesSubject.next({
        type: 'deselected',
        instanceId: currentSelected,
        timestamp: Date.now()
      });

      this.eventBus.publish({
        type: 'component:deselected',
        instanceId: currentSelected,
        timestamp: Date.now()
      });
    }

    // Set new selection
    this._selectedInstanceId.set(instanceId);

    // Select new
    if (instanceId) {
      this.update(instanceId, { isSelected: true });
      
      const instance = this.get(instanceId);
      if (instance) {
        // Emit selected event
        this.stateChangesSubject.next({
          type: 'selected',
          instanceId,
          timestamp: Date.now()
        });

        this.eventBus.publish({
          type: 'component:selected',
          instanceId,
          componentId: instance.metadata.id,
          timestamp: Date.now()
        });
      }
    }

    return true;
  }

  /**
   * Get currently selected instance
   * 
   * @returns Selected instance or undefined
   */
  getSelected(): ComponentInstance | undefined {
    const selectedId = this._selectedInstanceId();
    return selectedId ? this.get(selectedId) : undefined;
  }

  /**
   * Check if an instance exists
   * 
   * @param instanceId - Instance ID
   * @returns True if exists
   */
  has(instanceId: string): boolean {
    return this._instances().has(instanceId);
  }

  /**
   * Get instance count
   * 
   * @returns Total number of instances
   */
  getCount(): number {
    return this._instances().size;
  }

  /**
   * Clear all instances
   */
  clear(): void {
    this._instances.set(new Map());
    this._selectedInstanceId.set(null);

    // Emit change event
    const change: ComponentStateChange = {
      type: 'cleared',
      timestamp: Date.now()
    };
    this.stateChangesSubject.next(change);
  }

  /**
   * Set property editor visibility
   * 
   * @param visible - Whether property editor should be visible
   */
  setPropertyEditorVisible(visible: boolean): void {
    this._isPropertyEditorVisible.set(visible);

    // Publish to event bus
    if (visible) {
      const selectedId = this._selectedInstanceId();
      if (selectedId) {
        this.eventBus.publish({
          type: 'property-editor:opened',
          instanceId: selectedId,
          timestamp: Date.now()
        });
      }
    } else {
      const selectedId = this._selectedInstanceId();
      this.eventBus.publish({
        type: 'property-editor:closed',
        instanceId: selectedId ?? undefined,
        saved: false,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Get state snapshot
   * 
   * @returns Immutable snapshot of current state
   */
  getSnapshot(): ComponentStateSnapshot {
    return {
      instances: this.getAll(),
      selectedInstanceId: this._selectedInstanceId(),
      isPropertyEditorVisible: this._isPropertyEditorVisible(),
      timestamp: Date.now()
    };
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.stateChangesSubject.complete();
  }
}
