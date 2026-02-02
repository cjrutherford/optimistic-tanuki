/**
 * Component Renderer Service
 * 
 * Handles component rendering using Angular CDK Portal.
 * Pure rendering logic with no state management or registration.
 * 
 * @example
 * ```typescript
 * // Render a component
 * const result = await renderer.render(
 *   'callout-box',
 *   'instance-123',
 *   targetElement,
 *   { type: 'info', title: 'Note' }
 * );
 * 
 * // Update component data
 * renderer.update('instance-123', { title: 'Updated Title' });
 * 
 * // Destroy component
 * renderer.destroy('instance-123');
 * 
 * // Subscribe to render events
 * renderer.renderEvents$.subscribe(event => {
 *   console.log('Render event:', event);
 * });
 * ```
 */

import { Injectable, ApplicationRef, Injector, ComponentRef } from '@angular/core';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import { Subject, Observable } from 'rxjs';
import {
  ComponentRenderResult,
  ComponentWrapperConfig,
  ComponentLifecyclePhase,
  ComponentRenderError
} from '../../types/rendering-types';
import {
  ComponentRendererAPI,
  ComponentRenderEvent,
  RenderStats
} from '../../interfaces/component-renderer.interface';
import { ComponentData } from '../../types/property-types';
import { ComponentEventBusService } from './component-event-bus.service';
import { ComponentRegistryService } from './component-registry.service';

/**
 * Component Renderer Service
 * 
 * Implements CDK Portal-based component rendering.
 * Manages component lifecycle, portals, and change detection.
 */
@Injectable({
  providedIn: 'root'
})
export class ComponentRendererService implements ComponentRendererAPI {
  /**
   * Render results storage
   * @private
   */
  private readonly renderResults = new Map<string, ComponentRenderResult>();

  /**
   * Render events subject
   * @private
   */
  private readonly renderEventsSubject = new Subject<ComponentRenderEvent>();

  /**
   * Statistics
   * @private
   */
  private stats: RenderStats = {
    totalRenders: 0,
    currentlyRendered: 0,
    totalUpdates: 0,
    totalDestroys: 0,
    avgRenderTime: 0,
    errors: 0
  };

  /**
   * Render times for average calculation
   * @private
   */
  private readonly renderTimes: number[] = [];

  /**
   * Observable of render events
   */
  readonly renderEvents$: Observable<ComponentRenderEvent> = this.renderEventsSubject.asObservable();

  constructor(
    private readonly eventBus: ComponentEventBusService,
    private readonly registry: ComponentRegistryService,
    private readonly appRef: ApplicationRef,
    private readonly injector: Injector
  ) {}

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
  async render(
    componentId: string,
    instanceId: string,
    targetElement: HTMLElement,
    data: ComponentData,
    wrapperConfig?: ComponentWrapperConfig
  ): Promise<ComponentRenderResult> {
    const startTime = performance.now();

    try {
      // Get component metadata from registry
      const metadata = this.registry.get(componentId);
      if (!metadata) {
        throw new ComponentRenderError(
          `Component '${componentId}' not found in registry`,
          instanceId,
          componentId
        );
      }

      // Check if already rendered
      if (this.renderResults.has(instanceId)) {
        throw new ComponentRenderError(
          `Component instance '${instanceId}' is already rendered`,
          instanceId,
          componentId
        );
      }

      // Create component portal
      const componentPortal = new ComponentPortal(
        metadata.component,
        null,
        this.injector
      );

      // Create DOM portal outlet
      const portalOutlet = new DomPortalOutlet(
        targetElement,
        null, // ComponentFactoryResolver is deprecated in Angular 20
        this.appRef,
        this.injector
      );

      // Attach portal to outlet
      const componentRef = portalOutlet.attach(componentPortal);

      // Set component inputs (data)
      this.applyDataToComponent(componentRef, data);

      // Trigger change detection
      this.appRef.tick();

      // Create render result
      const result: ComponentRenderResult = {
        instanceId,
        componentRef,
        portalOutlet,
        element: targetElement,
        renderedAt: Date.now(),
        lifecyclePhase: 'rendered'
      };

      // Store result
      this.renderResults.set(instanceId, result);

      // Update statistics
      const renderTime = performance.now() - startTime;
      this.updateRenderStats(renderTime);

      // Increment usage in registry
      this.registry.incrementUsage(componentId);

      // Emit render event
      this.emitRenderEvent({
        type: 'rendered',
        instanceId,
        componentId,
        timestamp: Date.now()
      });

      // Publish to event bus
      this.eventBus.publish({
        type: 'component:rendered',
        instanceId,
        element: targetElement,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      // Update error statistics
      this.stats.errors++;

      // Emit error event
      this.emitRenderEvent({
        type: 'error',
        instanceId,
        componentId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      });

      // Re-throw as ComponentRenderError
      if (error instanceof ComponentRenderError) {
        throw error;
      }
      throw new ComponentRenderError(
        `Failed to render component: ${error instanceof Error ? error.message : String(error)}`,
        instanceId,
        componentId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Update a rendered component's data
   * 
   * @param instanceId - Instance ID
   * @param data - New/updated property values
   * @returns True if updated successfully
   */
  update(instanceId: string, data: Partial<ComponentData>): boolean {
    const result = this.renderResults.get(instanceId);
    
    if (!result) {
      return false;
    }

    try {
      // Apply updated data to component
      this.applyDataToComponent(result.componentRef, data);

      // Trigger change detection
      result.componentRef.changeDetectorRef.markForCheck();
      this.appRef.tick();

      // Update statistics
      this.stats.totalUpdates++;

      // Emit update event
      this.emitRenderEvent({
        type: 'updated',
        instanceId,
        componentId: '', // Would need to store componentId in result
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error('[ComponentRenderer] Update failed:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Destroy a rendered component
   * 
   * Cleans up portal, component ref, and DOM
   * 
   * @param instanceId - Instance ID
   * @returns True if destroyed successfully
   */
  destroy(instanceId: string): boolean {
    const result = this.renderResults.get(instanceId);
    
    if (!result) {
      return false;
    }

    try {
      // Update lifecycle phase
      result.lifecyclePhase = 'destroying';

      // Detach and dispose portal
      if (result.portalOutlet.hasAttached()) {
        result.portalOutlet.detach();
      }
      result.portalOutlet.dispose();

      // Remove from storage
      this.renderResults.delete(instanceId);

      // Update statistics
      this.stats.currentlyRendered--;
      this.stats.totalDestroys++;

      // Emit destroy event
      this.emitRenderEvent({
        type: 'destroyed',
        instanceId,
        componentId: '', // Would need to store componentId in result
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      console.error('[ComponentRenderer] Destroy failed:', error);
      this.stats.errors++;
      return false;
    }
  }

  /**
   * Get render result for an instance
   * 
   * @param instanceId - Instance ID
   * @returns Render result or undefined if not found
   */
  getRenderResult(instanceId: string): ComponentRenderResult | undefined {
    return this.renderResults.get(instanceId);
  }

  /**
   * Check if an instance is currently rendered
   * 
   * @param instanceId - Instance ID
   * @returns True if rendered
   */
  isRendered(instanceId: string): boolean {
    return this.renderResults.has(instanceId);
  }

  /**
   * Get all currently rendered instances
   * 
   * @returns Array of instance IDs
   */
  getRenderedInstances(): readonly string[] {
    return Array.from(this.renderResults.keys());
  }

  /**
   * Re-render a component
   * 
   * Destroys and re-creates the component
   * 
   * @param instanceId - Instance ID
   * @returns New render result
   */
  async rerender(instanceId: string): Promise<ComponentRenderResult> {
    const result = this.renderResults.get(instanceId);
    
    if (!result) {
      throw new Error(`Cannot rerender: instance '${instanceId}' not found`);
    }

    // Store current data (would need to be tracked)
    const targetElement = result.element;

    // Destroy current render
    this.destroy(instanceId);

    // Re-render (would need componentId and data to be stored)
    throw new Error('Rerender not fully implemented - needs componentId and data tracking');
  }

  /**
   * Trigger change detection on a rendered component
   * 
   * @param instanceId - Instance ID
   */
  detectChanges(instanceId: string): void {
    const result = this.renderResults.get(instanceId);
    
    if (result) {
      result.componentRef.changeDetectorRef.markForCheck();
      this.appRef.tick();
    }
  }

  /**
   * Destroy all rendered components
   */
  destroyAll(): void {
    const instanceIds = Array.from(this.renderResults.keys());
    
    for (const instanceId of instanceIds) {
      this.destroy(instanceId);
    }
  }

  /**
   * Get render statistics
   * 
   * @returns Statistics object
   */
  getStats(): RenderStats {
    return { ...this.stats };
  }

  /**
   * Apply data to component instance
   * Sets component inputs based on data object
   * @private
   */
  private applyDataToComponent(
    componentRef: ComponentRef<unknown>,
    data: Partial<ComponentData>
  ): void {
    const instance = componentRef.instance as Record<string, unknown>;
    
    for (const [key, value] of Object.entries(data)) {
      if (key in instance) {
        instance[key] = value;
      }
    }
  }

  /**
   * Update render statistics
   * @private
   */
  private updateRenderStats(renderTime: number): void {
    this.stats.totalRenders++;
    this.stats.currentlyRendered++;

    // Track render time for average
    this.renderTimes.push(renderTime);
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift(); // Keep last 100
    }

    // Calculate average
    const sum = this.renderTimes.reduce((a, b) => a + b, 0);
    this.stats.avgRenderTime = sum / this.renderTimes.length;
  }

  /**
   * Emit render event
   * @private
   */
  private emitRenderEvent(event: ComponentRenderEvent): void {
    this.renderEventsSubject.next(event);
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.destroyAll();
    this.renderEventsSubject.complete();
  }
}
