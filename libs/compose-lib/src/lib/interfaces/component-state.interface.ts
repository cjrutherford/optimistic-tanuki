/**
 * Component State Interface
 * 
 * Defines the API for component state management using signals.
 * Pure state management - no rendering or registration logic.
 * 
 * @module ComponentState
 */

import { Signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ComponentInstance, ComponentInstanceMap, ComponentInstanceQuery, ComponentInstanceQueryResult } from './component-instance.interface';
import { ComponentMetadata } from './component-metadata.interface';
import { ComponentData } from '../types/property-types';

/**
 * Component State API
 * Service interface for managing component instance state
 */
export interface ComponentStateAPI {
  /**
   * Add a new component instance to state
   * 
   * @param instance - Component instance
   */
  add(instance: ComponentInstance): void;

  /**
   * Update an existing component instance
   * 
   * @param instanceId - Instance ID
   * @param updates - Partial instance updates
   * @returns True if updated
   */
  update(instanceId: string, updates: Partial<ComponentInstance>): boolean;

  /**
   * Update component data
   * 
   * @param instanceId - Instance ID
   * @param data - New/updated data
   * @returns True if updated
   */
  updateData(instanceId: string, data: Partial<ComponentData>): boolean;

  /**
   * Remove a component instance
   * 
   * @param instanceId - Instance ID
   * @returns True if removed
   */
  remove(instanceId: string): boolean;

  /**
   * Get a component instance by ID
   * 
   * @param instanceId - Instance ID
   * @returns Instance or undefined
   */
  get(instanceId: string): ComponentInstance | undefined;

  /**
   * Get all component instances
   * 
   * @returns Readonly array of all instances
   */
  getAll(): readonly ComponentInstance[];

  /**
   * Query component instances
   * 
   * @param query - Query criteria
   * @returns Query result
   */
  query(query: ComponentInstanceQuery): ComponentInstanceQueryResult;

  /**
   * Select a component instance
   * 
   * @param instanceId - Instance ID to select (null to deselect all)
   * @returns True if selection changed
   */
  select(instanceId: string | null): boolean;

  /**
   * Get currently selected instance
   * 
   * @returns Selected instance or undefined
   */
  getSelected(): ComponentInstance | undefined;

  /**
   * Check if an instance exists
   * 
   * @param instanceId - Instance ID
   * @returns True if exists
   */
  has(instanceId: string): boolean;

  /**
   * Get instance count
   * 
   * @returns Total number of instances
   */
  getCount(): number;

  /**
   * Clear all instances
   */
  clear(): void;

  /**
   * Set property editor visibility
   * 
   * @param visible - Whether property editor should be visible
   */
  setPropertyEditorVisible(visible: boolean): void;

  /**
   * Signal: All component instances (reactive)
   */
  readonly instances: Signal<ComponentInstanceMap>;

  /**
   * Signal: Currently selected instance ID (reactive)
   */
  readonly selectedInstanceId: Signal<string | null>;

  /**
   * Signal: Property editor visibility (reactive)
   */
  readonly isPropertyEditorVisible: Signal<boolean>;

  /**
   * Observable: State changes
   */
  readonly stateChanges$: Observable<ComponentStateChange>;
}

/**
 * Component state change event
 */
export interface ComponentStateChange {
  /** Type of change */
  readonly type: 'added' | 'updated' | 'removed' | 'selected' | 'deselected' | 'cleared';

  /** Instance ID (undefined for cleared) */
  readonly instanceId?: string;

  /** Previous state (for updates) */
  readonly previousState?: ComponentInstance;

  /** New state (for adds/updates) */
  readonly newState?: ComponentInstance;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Component state snapshot
 * Immutable snapshot of entire state
 */
export interface ComponentStateSnapshot {
  readonly instances: readonly ComponentInstance[];
  readonly selectedInstanceId: string | null;
  readonly isPropertyEditorVisible: boolean;
  readonly timestamp: number;
}
