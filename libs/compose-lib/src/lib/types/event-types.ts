/**
 * Event Type System for Component Injection
 * 
 * Provides type-safe event definitions for all component lifecycle
 * and user interaction events.
 * 
 * @module EventTypes
 */

import { ComponentData } from './property-types';

/**
 * Base event interface
 * All component events extend this
 */
export interface BaseComponentEvent {
  /** Unique event type identifier */
  readonly type: string;
  
  /** Timestamp when event occurred */
  readonly timestamp: number;
  
  /** Optional event source identifier */
  readonly source?: string;
}

/**
 * Component inserted event
 * Fired when a new component instance is added to the editor
 */
export interface ComponentInsertedEvent extends BaseComponentEvent {
  readonly type: 'component:inserted';
  
  /** ID of the inserted component instance */
  readonly instanceId: string;
  
  /** ID of the component type */
  readonly componentId: string;
  
  /** Initial component data */
  readonly data: ComponentData;
  
  /** Position where component was inserted */
  readonly position?: number;
}

/**
 * Component updated event
 * Fired when component data is modified
 */
export interface ComponentUpdatedEvent extends BaseComponentEvent {
  readonly type: 'component:updated';
  
  /** ID of the updated component instance */
  readonly instanceId: string;
  
  /** Previous component data */
  readonly oldData: ComponentData;
  
  /** New component data */
  readonly newData: ComponentData;
  
  /** Changed property keys */
  readonly changedKeys: readonly string[];
}

/**
 * Component removed event
 * Fired when a component instance is deleted
 */
export interface ComponentRemovedEvent extends BaseComponentEvent {
  readonly type: 'component:removed';
  
  /** ID of the removed component instance */
  readonly instanceId: string;
  
  /** ID of the component type */
  readonly componentId: string;
  
  /** Component data at time of removal */
  readonly data: ComponentData;
}

/**
 * Component moved event
 * Fired when a component instance changes position
 */
export interface ComponentMovedEvent extends BaseComponentEvent {
  readonly type: 'component:moved';
  
  /** ID of the moved component instance */
  readonly instanceId: string;
  
  /** Previous position */
  readonly oldPosition: number;
  
  /** New position */
  readonly newPosition: number;
}

/**
 * Component selected event
 * Fired when a component instance is selected for editing
 */
export interface ComponentSelectedEvent extends BaseComponentEvent {
  readonly type: 'component:selected';
  
  /** ID of the selected component instance */
  readonly instanceId: string;
  
  /** ID of the component type */
  readonly componentId: string;
}

/**
 * Component deselected event
 * Fired when a component instance is deselected
 */
export interface ComponentDeselectedEvent extends BaseComponentEvent {
  readonly type: 'component:deselected';
  
  /** ID of the deselected component instance */
  readonly instanceId: string;
}

/**
 * Component registered event
 * Fired when a new component type is registered
 */
export interface ComponentRegisteredEvent extends BaseComponentEvent {
  readonly type: 'component:registered';
  
  /** ID of the registered component type */
  readonly componentId: string;
  
  /** Component category */
  readonly category?: string;
}

/**
 * Component unregistered event
 * Fired when a component type is unregistered
 */
export interface ComponentUnregisteredEvent extends BaseComponentEvent {
  readonly type: 'component:unregistered';
  
  /** ID of the unregistered component type */
  readonly componentId: string;
}

/**
 * Component rendered event
 * Fired when a component instance is rendered to the DOM
 */
export interface ComponentRenderedEvent extends BaseComponentEvent {
  readonly type: 'component:rendered';
  
  /** ID of the rendered component instance */
  readonly instanceId: string;
  
  /** DOM element where component was rendered */
  readonly element?: HTMLElement;
}

/**
 * Component error event
 * Fired when an error occurs during component operations
 */
export interface ComponentErrorEvent extends BaseComponentEvent {
  readonly type: 'component:error';
  
  /** Error message */
  readonly error: string;
  
  /** Related component instance ID (if applicable) */
  readonly instanceId?: string;
  
  /** Related component type ID (if applicable) */
  readonly componentId?: string;
  
  /** Original error object */
  readonly originalError?: Error;
}

/**
 * Drag start event
 * Fired when dragging a component begins
 */
export interface ComponentDragStartEvent extends BaseComponentEvent {
  readonly type: 'component:drag-start';
  
  /** ID of the component being dragged */
  readonly instanceId: string;
  
  /** Current position */
  readonly position: number;
}

/**
 * Drag end event
 * Fired when dragging a component ends
 */
export interface ComponentDragEndEvent extends BaseComponentEvent {
  readonly type: 'component:drag-end';
  
  /** ID of the component being dragged */
  readonly instanceId: string;
  
  /** Final position */
  readonly position: number;
  
  /** Whether the drag resulted in a position change */
  readonly moved: boolean;
}

/**
 * Property editor opened event
 * Fired when the property editor is opened for a component
 */
export interface PropertyEditorOpenedEvent extends BaseComponentEvent {
  readonly type: 'property-editor:opened';
  
  /** ID of the component instance being edited */
  readonly instanceId: string;
}

/**
 * Property editor closed event
 * Fired when the property editor is closed
 */
export interface PropertyEditorClosedEvent extends BaseComponentEvent {
  readonly type: 'property-editor:closed';
  
  /** ID of the component instance that was being edited */
  readonly instanceId?: string;
  
  /** Whether changes were saved */
  readonly saved: boolean;
}

/**
 * Union type of all component events
 * Use this for type-safe event handling
 */
export type ComponentEvent =
  | ComponentInsertedEvent
  | ComponentUpdatedEvent
  | ComponentRemovedEvent
  | ComponentMovedEvent
  | ComponentSelectedEvent
  | ComponentDeselectedEvent
  | ComponentRegisteredEvent
  | ComponentUnregisteredEvent
  | ComponentRenderedEvent
  | ComponentErrorEvent
  | ComponentDragStartEvent
  | ComponentDragEndEvent
  | PropertyEditorOpenedEvent
  | PropertyEditorClosedEvent;

/**
 * Event handler type
 * Generic handler that receives specific event types
 */
export type ComponentEventHandler<T extends ComponentEvent = ComponentEvent> = (
  event: T
) => void;

/**
 * Event filter function
 * Returns true if event should be processed
 */
export type ComponentEventFilter = (event: ComponentEvent) => boolean;

/**
 * Event subscription
 * Returned when subscribing to events, used to unsubscribe
 */
export interface ComponentEventSubscription {
  /** Unsubscribe from events */
  unsubscribe: () => void;
  
  /** Whether this subscription is still active */
  readonly active: boolean;
}

/**
 * Event emitter options
 */
export interface EventEmitterOptions {
  /** Maximum number of events to keep in history */
  readonly maxHistory?: number;
  
  /** Whether to log events to console */
  readonly debug?: boolean;
  
  /** Custom event filter */
  readonly filter?: ComponentEventFilter;
}
