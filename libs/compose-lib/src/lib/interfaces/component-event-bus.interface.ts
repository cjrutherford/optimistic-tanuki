/**
 * Component Event Bus Interface
 * 
 * Defines the API for type-safe event coordination.
 * Centralized event publishing and subscription system.
 * 
 * @module ComponentEventBus
 */

import { Observable } from 'rxjs';
import {
  ComponentEvent,
  ComponentEventHandler,
  ComponentEventFilter,
  ComponentEventSubscription,
  EventEmitterOptions
} from '../types/event-types';

/**
 * Component Event Bus API
 * Service interface for event coordination
 */
export interface ComponentEventBusAPI {
  /**
   * Publish an event
   * 
   * @param event - Event to publish
   */
  publish(event: ComponentEvent): void;

  /**
   * Subscribe to all events
   * 
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribe(handler: ComponentEventHandler): ComponentEventSubscription;

  /**
   * Subscribe to specific event type
   * 
   * @param type - Event type to listen for
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribeToType<T extends ComponentEvent['type']>(
    type: T,
    handler: ComponentEventHandler<Extract<ComponentEvent, { type: T }>>
  ): ComponentEventSubscription;

  /**
   * Subscribe with filter
   * 
   * @param filter - Filter function
   * @param handler - Event handler function
   * @returns Subscription for unsubscribing
   */
  subscribeWithFilter(
    filter: ComponentEventFilter,
    handler: ComponentEventHandler
  ): ComponentEventSubscription;

  /**
   * Get event history
   * 
   * @param limit - Maximum number of events to return
   * @returns Array of recent events
   */
  getHistory(limit?: number): readonly ComponentEvent[];

  /**
   * Get events by type from history
   * 
   * @param type - Event type
   * @param limit - Maximum number of events to return
   * @returns Array of events of this type
   */
  getHistoryByType<T extends ComponentEvent['type']>(
    type: T,
    limit?: number
  ): readonly Extract<ComponentEvent, { type: T }>[];

  /**
   * Clear event history
   */
  clearHistory(): void;

  /**
   * Get subscriber count
   * 
   * @returns Number of active subscriptions
   */
  getSubscriberCount(): number;

  /**
   * Observable of all events
   */
  readonly events$: Observable<ComponentEvent>;

  /**
   * Observable of specific event type
   * 
   * @param type - Event type to observe
   * @returns Observable of events of this type
   */
  ofType<T extends ComponentEvent['type']>(
    type: T
  ): Observable<Extract<ComponentEvent, { type: T }>>;
}

/**
 * Event bus statistics
 */
export interface EventBusStats {
  /** Total events published */
  readonly totalPublished: number;

  /** Current subscriber count */
  readonly subscriberCount: number;

  /** Events by type count */
  readonly eventsByType: Readonly<Record<string, number>>;

  /** History size */
  readonly historySize: number;

  /** Most recent event */
  readonly lastEvent?: ComponentEvent;
}
