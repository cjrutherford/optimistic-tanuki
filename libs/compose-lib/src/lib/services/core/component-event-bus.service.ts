/**
 * Component Event Bus Service
 * 
 * Centralized, type-safe event coordination for the component injection system.
 * Provides event publishing, subscription, filtering, and history tracking.
 * 
 * @example
 * ```typescript
 * // Publish an event
 * eventBus.publish({
 *   type: 'component:inserted',
 *   instanceId: 'abc123',
 *   componentId: 'callout-box',
 *   data: { type: 'info' },
 *   timestamp: Date.now()
 * });
 * 
 * // Subscribe to all events
 * const subscription = eventBus.subscribe(event => {
 *   console.log('Event:', event);
 * });
 * 
 * // Subscribe to specific event type
 * eventBus.subscribeToType('component:updated', event => {
 *   console.log('Component updated:', event.instanceId);
 * });
 * 
 * // Cleanup
 * subscription.unsubscribe();
 * ```
 */

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter } from 'rxjs/operators';
import {
  ComponentEvent,
  ComponentEventHandler,
  ComponentEventFilter,
  ComponentEventSubscription
} from '../../types/event-types';
import {
  ComponentEventBusAPI,
  EventBusStats
} from '../../interfaces/component-event-bus.interface';

/**
 * Component Event Bus Service
 * 
 * Implements type-safe event coordination using RxJS.
 * All component lifecycle and user interaction events flow through this service.
 */
@Injectable({
  providedIn: 'root'
})
export class ComponentEventBusService implements ComponentEventBusAPI {
  /**
   * RxJS Subject for event stream
   * @private
   */
  private readonly eventSubject = new Subject<ComponentEvent>();

  /**
   * Event history storage
   * @private
   */
  private readonly eventHistory: ComponentEvent[] = [];

  /**
   * Maximum history size
   * @private
   */
  private readonly maxHistorySize = 100;

  /**
   * Active subscriptions
   * @private
   */
  private readonly subscriptions = new Set<ComponentEventSubscription>();

  /**
   * Total events published counter
   * @private
   */
  private totalPublished = 0;

  /**
   * Events by type counter
   * @private
   */
  private readonly eventsByType = new Map<string, number>();

  /**
   * Debug mode flag
   * @private
   */
  private debugMode = false;

  /**
   * Observable of all events
   * Public stream for external subscriptions
   */
  readonly events$: Observable<ComponentEvent> = this.eventSubject.asObservable();

  /**
   * Enable or disable debug logging
   * 
   * @param enabled - Whether to enable debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Publish an event
   * 
   * Emits the event to all subscribers and adds it to history
   * 
   * @param event - Event to publish
   */
  publish(event: ComponentEvent): void {
    // Validate event has required fields
    if (!event.type || !event.timestamp) {
      console.error('[EventBus] Invalid event:', event);
      return;
    }

    // Debug logging
    if (this.debugMode) {
      console.log('[EventBus] Publishing event:', event.type, event);
    }

    // Update statistics
    this.totalPublished++;
    const count = this.eventsByType.get(event.type) || 0;
    this.eventsByType.set(event.type, count + 1);

    // Add to history
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift(); // Remove oldest
    }

    // Emit to subscribers
    this.eventSubject.next(event);
  }

  /**
   * Subscribe to all events
   * 
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribe(handler: ComponentEventHandler): ComponentEventSubscription {
    const rxSubscription = this.events$.subscribe(handler);
    
    const subscription: ComponentEventSubscription = {
      unsubscribe: () => {
        rxSubscription.unsubscribe();
        this.subscriptions.delete(subscription);
      },
      active: true
    };

    // Track subscription
    this.subscriptions.add(subscription);

    // Override active getter
    Object.defineProperty(subscription, 'active', {
      get: () => !rxSubscription.closed
    });

    return subscription;
  }

  /**
   * Subscribe to specific event type
   * 
   * Uses RxJS filter operator for type-safe filtering
   * 
   * @param type - Event type to listen for
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribeToType<T extends ComponentEvent['type']>(
    type: T,
    handler: ComponentEventHandler<Extract<ComponentEvent, { type: T }>>
  ): ComponentEventSubscription {
    const rxSubscription = this.ofType(type).subscribe(handler);
    
    const subscription: ComponentEventSubscription = {
      unsubscribe: () => {
        rxSubscription.unsubscribe();
        this.subscriptions.delete(subscription);
      },
      active: true
    };

    this.subscriptions.add(subscription);

    Object.defineProperty(subscription, 'active', {
      get: () => !rxSubscription.closed
    });

    return subscription;
  }

  /**
   * Subscribe with custom filter
   * 
   * @param filterFn - Filter function
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribeWithFilter(
    filterFn: ComponentEventFilter,
    handler: ComponentEventHandler
  ): ComponentEventSubscription {
    const rxSubscription = this.events$
      .pipe(filter(filterFn))
      .subscribe(handler);
    
    const subscription: ComponentEventSubscription = {
      unsubscribe: () => {
        rxSubscription.unsubscribe();
        this.subscriptions.delete(subscription);
      },
      active: true
    };

    this.subscriptions.add(subscription);

    Object.defineProperty(subscription, 'active', {
      get: () => !rxSubscription.closed
    });

    return subscription;
  }

  /**
   * Get event history
   * 
   * @param limit - Maximum number of events to return
   * @returns Array of recent events (newest first)
   */
  getHistory(limit?: number): readonly ComponentEvent[] {
    const history = [...this.eventHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get events by type from history
   * 
   * @param type - Event type
   * @param limit - Maximum number of events to return
   * @returns Array of events of this type (newest first)
   */
  getHistoryByType<T extends ComponentEvent['type']>(
    type: T,
    limit?: number
  ): readonly Extract<ComponentEvent, { type: T }>[] {
    const filtered = this.eventHistory
      .filter((event): event is Extract<ComponentEvent, { type: T }> => event.type === type)
      .reverse();
    
    return limit ? filtered.slice(0, limit) : filtered;
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.eventHistory.length = 0;
    if (this.debugMode) {
      console.log('[EventBus] History cleared');
    }
  }

  /**
   * Get subscriber count
   * 
   * @returns Number of active subscriptions
   */
  getSubscriberCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Observable of specific event type
   * 
   * @param type - Event type to observe
   * @returns Observable of events of this type
   */
  ofType<T extends ComponentEvent['type']>(
    type: T
  ): Observable<Extract<ComponentEvent, { type: T }>> {
    return this.events$.pipe(
      filter((event): event is Extract<ComponentEvent, { type: T }> => event.type === type)
    );
  }

  /**
   * Get event bus statistics
   * 
   * @returns Statistics object
   */
  getStats(): EventBusStats {
    return {
      totalPublished: this.totalPublished,
      subscriberCount: this.subscriptions.size,
      eventsByType: Object.fromEntries(this.eventsByType),
      historySize: this.eventHistory.length,
      lastEvent: this.eventHistory.length > 0 
        ? this.eventHistory[this.eventHistory.length - 1] 
        : undefined
    };
  }

  /**
   * Reset all statistics
   * Useful for testing
   */
  resetStats(): void {
    this.totalPublished = 0;
    this.eventsByType.clear();
    this.clearHistory();
  }

  /**
   * Cleanup on service destroy
   * Angular will call this when the service is destroyed
   */
  ngOnDestroy(): void {
    this.eventSubject.complete();
    this.subscriptions.clear();
  }
}
