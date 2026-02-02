/**
 * Component Renderer Interface
 * 
 * Defines the API for component rendering using Angular CDK Portal.
 * Pure rendering logic - no state management or registration.
 * 
 * @module ComponentRenderer
 */

import { Observable } from 'rxjs';
import { ComponentInstance } from './component-instance.interface';
import { ComponentData } from '../types/property-types';
import {
  ComponentRenderResult,
  ComponentWrapperConfig,
  ComponentRendererOptions,
  RenderContext,
  CleanupFunction
} from '../types/rendering-types';

/**
 * Component Renderer API
 * Service interface for rendering components using CDK Portal
 */
export interface ComponentRendererAPI {
  /**
   * Render a component into a target element
   * 
   * @param componentId - ID of component type to render
   * @param instanceId - Unique instance identifier
   * @param targetElement - DOM element to render into
   * @param data - Component property values
   * @param wrapperConfig - Optional wrapper configuration
   * @returns Render result with component and portal references
   */
  render(
    componentId: string,
    instanceId: string,
    targetElement: HTMLElement,
    data: ComponentData,
    wrapperConfig?: ComponentWrapperConfig
  ): Promise<ComponentRenderResult>;

  /**
   * Update a rendered component's data
   * 
   * @param instanceId - Instance ID
   * @param data - New/updated property values
   * @returns True if updated successfully
   */
  update(instanceId: string, data: Partial<ComponentData>): boolean;

  /**
   * Destroy a rendered component
   * Cleans up portal, component ref, and DOM
   * 
   * @param instanceId - Instance ID
   * @returns True if destroyed successfully
   */
  destroy(instanceId: string): boolean;

  /**
   * Get render result for an instance
   * 
   * @param instanceId - Instance ID
   * @returns Render result or undefined if not found
   */
  getRenderResult(instanceId: string): ComponentRenderResult | undefined;

  /**
   * Check if an instance is currently rendered
   * 
   * @param instanceId - Instance ID
   * @returns True if rendered
   */
  isRendered(instanceId: string): boolean;

  /**
   * Get all currently rendered instances
   * 
   * @returns Array of instance IDs
   */
  getRenderedInstances(): readonly string[];

  /**
   * Re-render a component
   * Destroys and re-creates the component
   * 
   * @param instanceId - Instance ID
   * @returns New render result
   */
  rerender(instanceId: string): Promise<ComponentRenderResult>;

  /**
   * Trigger change detection on a rendered component
   * 
   * @param instanceId - Instance ID
   */
  detectChanges(instanceId: string): void;

  /**
   * Destroy all rendered components
   */
  destroyAll(): void;

  /**
   * Observable of render events
   */
  readonly renderEvents$: Observable<ComponentRenderEvent>;
}

/**
 * Component render event
 */
export interface ComponentRenderEvent {
  /** Event type */
  readonly type: 'rendered' | 'updated' | 'destroyed' | 'error';

  /** Instance ID */
  readonly instanceId: string;

  /** Component ID */
  readonly componentId: string;

  /** Error message (for error events) */
  readonly error?: string;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Render queue item
 * Used for batching render operations
 */
export interface RenderQueueItem {
  readonly componentId: string;
  readonly instanceId: string;
  readonly targetElement: HTMLElement;
  readonly data: ComponentData;
  readonly wrapperConfig?: ComponentWrapperConfig;
  readonly priority: number;
}

/**
 * Render statistics
 */
export interface RenderStats {
  /** Total renders performed */
  readonly totalRenders: number;

  /** Currently rendered count */
  readonly currentlyRendered: number;

  /** Total updates performed */
  readonly totalUpdates: number;

  /** Total destroys performed */
  readonly totalDestroys: number;

  /** Average render time (ms) */
  readonly avgRenderTime: number;

  /** Errors encountered */
  readonly errors: number;
}
