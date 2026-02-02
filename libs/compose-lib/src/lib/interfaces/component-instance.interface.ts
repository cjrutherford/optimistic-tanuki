/**
 * Component Instance Interface
 * 
 * Defines the structure for runtime component instances.
 * These are actual occurrences of components in the editor.
 * 
 * @module ComponentInstance
 */

import { ComponentRef } from '@angular/core';
import { DomPortalOutlet } from '@angular/cdk/portal';
import { ComponentMetadata } from './component-metadata.interface';
import { ComponentData } from '../types/property-types';
import { ComponentPosition, ComponentLifecyclePhase } from '../types/rendering-types';

/**
 * Component instance state
 * Tracks the current state of a component instance
 */
export type ComponentInstanceState =
  | 'creating'    // Being created
  | 'active'      // Active in editor
  | 'selected'    // Selected for editing
  | 'dragging'    // Being dragged
  | 'updating'    // Being updated
  | 'destroying'  // Being destroyed
  | 'error';      // Error state

/**
 * Component instance
 * Represents a specific occurrence of a component in the editor
 */
export interface ComponentInstance {
  /**
   * Unique instance identifier
   * Generated when component is inserted
   * @example 'callout-box_1234567890_abc123'
   */
  readonly instanceId: string;

  /**
   * Reference to the component metadata
   * Links to the component type definition
   */
  readonly metadata: ComponentMetadata;

  /**
   * Current property values for this instance
   * Mutable - can be updated during component lifetime
   */
  data: ComponentData;

  /**
   * Current instance state
   */
  state: ComponentInstanceState;

  /**
   * Lifecycle phase
   */
  lifecyclePhase: ComponentLifecyclePhase;

  /**
   * Angular ComponentRef
   * Available after component is rendered
   */
  componentRef?: ComponentRef<unknown>;

  /**
   * CDK Portal outlet
   * Used for component cleanup
   */
  portalOutlet?: DomPortalOutlet;

  /**
   * DOM element where component is rendered
   */
  element?: HTMLElement;

  /**
   * Position in the editor
   */
  position?: ComponentPosition;

  /**
   * Timestamp when instance was created
   */
  readonly createdAt: number;

  /**
   * Timestamp of last update
   */
  updatedAt: number;

  /**
   * Timestamp when rendered
   */
  renderedAt?: number;

  /**
   * Whether this instance is currently selected
   */
  isSelected: boolean;

  /**
   * Whether this instance is currently being dragged
   */
  isDragging: boolean;

  /**
   * Whether this instance has unsaved changes
   */
  isDirty: boolean;

  /**
   * Error message if instance is in error state
   */
  error?: string;

  /**
   * Original error object if available
   */
  originalError?: Error;

  /**
   * Custom metadata attached to this instance
   * Can be used by extensions or custom logic
   */
  customMetadata?: Record<string, unknown>;
}

/**
 * Partial component instance for updates
 * Used when updating only specific fields
 */
export type PartialComponentInstance = Partial<Omit<ComponentInstance, 'instanceId' | 'metadata' | 'createdAt'>>;

/**
 * Component instance snapshot
 * Immutable snapshot of instance state at a point in time
 */
export interface ComponentInstanceSnapshot {
  readonly instanceId: string;
  readonly componentId: string;
  readonly data: Readonly<ComponentData>;
  readonly state: ComponentInstanceState;
  readonly position?: Readonly<ComponentPosition>;
  readonly timestamp: number;
}

/**
 * Component instance collection
 * Efficient storage for multiple instances
 */
export type ComponentInstanceMap = ReadonlyMap<string, ComponentInstance>;

/**
 * Component instance query
 * For filtering/finding instances
 */
export interface ComponentInstanceQuery {
  /** Filter by component type ID */
  componentId?: string;

  /** Filter by state */
  state?: ComponentInstanceState;

  /** Filter by selected status */
  isSelected?: boolean;

  /** Filter by dirty status */
  isDirty?: boolean;

  /** Filter by position range */
  positionRange?: {
    min: number;
    max: number;
  };

  /** Custom filter function */
  customFilter?: (instance: ComponentInstance) => boolean;
}

/**
 * Component instance query result
 */
export interface ComponentInstanceQueryResult {
  /** Matching instances */
  readonly instances: readonly ComponentInstance[];

  /** Total count */
  readonly total: number;

  /** Query that was executed */
  readonly query: ComponentInstanceQuery;
}
