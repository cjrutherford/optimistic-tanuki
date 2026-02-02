/**
 * Rendering Type System for Component Injection
 * 
 * Provides type-safe configuration for component rendering using Angular CDK Portal
 * 
 * @module RenderingTypes
 */

import { ComponentRef, Injector, ApplicationRef } from '@angular/core';
import { DomPortalOutlet } from '@angular/cdk/portal';

/**
 * Component lifecycle phase
 */
export type ComponentLifecyclePhase =
  | 'creating'      // Component is being created
  | 'rendering'     // Component is being rendered to DOM
  | 'rendered'      // Component has been rendered
  | 'updating'      // Component is being updated
  | 'updated'       // Component has been updated
  | 'destroying'    // Component is being destroyed
  | 'destroyed';    // Component has been destroyed

/**
 * Component lifecycle hook
 * Called during specific lifecycle phases
 */
export type ComponentLifecycleHook = (instanceId: string, phase: ComponentLifecyclePhase) => void;

/**
 * Portal rendering configuration
 * Configuration for CDK Portal-based component rendering
 */
export interface PortalRenderConfig {
  /** Angular injector for dependency injection */
  readonly injector: Injector;
  
  /** Application reference for change detection */
  readonly applicationRef: ApplicationRef;
  
  /** Target DOM element where component will be rendered */
  readonly targetElement: HTMLElement;
  
  /** Optional custom CSS class for the portal container */
  readonly cssClass?: string;
  
  /** Whether to trigger change detection after rendering */
  readonly detectChanges?: boolean;
}

/**
 * Component render result
 * Contains references to the rendered component and portal
 */
export interface ComponentRenderResult {
  /** Unique instance identifier */
  readonly instanceId: string;
  
  /** Angular component reference */
  readonly componentRef: ComponentRef<unknown>;
  
  /** CDK Portal outlet */
  readonly portalOutlet: DomPortalOutlet;
  
  /** DOM element where component was rendered */
  readonly element: HTMLElement;
  
  /** Timestamp when rendered */
  readonly renderedAt: number;
  
  /** Current lifecycle phase */
  lifecyclePhase: ComponentLifecyclePhase;
}

/**
 * Component wrapper configuration
 * Configuration for wrapper that provides edit controls
 */
export interface ComponentWrapperConfig {
  /** Whether to show edit controls */
  readonly showControls?: boolean;
  
  /** Whether component is draggable */
  readonly draggable?: boolean;
  
  /** Whether component is currently selected */
  readonly selected?: boolean;
  
  /** Custom CSS classes for the wrapper */
  readonly cssClasses?: readonly string[];
  
  /** Whether to show component label */
  readonly showLabel?: boolean;
  
  /** Whether to show component icon */
  readonly showIcon?: boolean;
}

/**
 * Position information for a component in the editor
 */
export interface ComponentPosition {
  /** Zero-based index in the editor */
  readonly index: number;
  
  /** Optional TipTap node position */
  readonly nodePos?: number;
  
  /** Optional parent element */
  readonly parentElement?: HTMLElement;
  
  /** Bounding rectangle of the component */
  readonly bounds?: DOMRect;
}

/**
 * Render strategy
 * Determines how components are rendered
 */
export type RenderStrategy =
  | 'portal'        // Use CDK Portal (recommended)
  | 'viewContainer' // Use ViewContainerRef
  | 'dynamic';      // Use dynamic component loader

/**
 * Component renderer options
 * Global configuration for the renderer service
 */
export interface ComponentRendererOptions {
  /** Default render strategy */
  readonly strategy?: RenderStrategy;
  
  /** Whether to use wrapper components by default */
  readonly useWrapper?: boolean;
  
  /** Default wrapper configuration */
  readonly wrapperConfig?: ComponentWrapperConfig;
  
  /** Lifecycle hooks */
  readonly lifecycleHooks?: {
    readonly onCreate?: ComponentLifecycleHook;
    readonly onRender?: ComponentLifecycleHook;
    readonly onUpdate?: ComponentLifecycleHook;
    readonly onDestroy?: ComponentLifecycleHook;
  };
  
  /** Whether to enable debug logging */
  readonly debug?: boolean;
}

/**
 * Cleanup function
 * Called to cleanup rendered components
 */
export type CleanupFunction = () => void;

/**
 * Render context
 * Context information available during rendering
 */
export interface RenderContext {
  /** Component instance ID */
  readonly instanceId: string;
  
  /** Component type ID */
  readonly componentId: string;
  
  /** Target element */
  readonly targetElement: HTMLElement;
  
  /** Injector for DI */
  readonly injector: Injector;
  
  /** Application ref for change detection */
  readonly applicationRef: ApplicationRef;
  
  /** Optional position information */
  readonly position?: ComponentPosition;
  
  /** Whether this is a re-render */
  readonly isRerender?: boolean;
}

/**
 * Render error
 * Thrown when rendering fails
 */
export class ComponentRenderError extends Error {
  constructor(
    message: string,
    public readonly instanceId: string,
    public readonly componentId: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ComponentRenderError';
  }
}
