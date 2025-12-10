import { ComponentRef, Type } from '@angular/core';

/**
 * Interface for components that can be dynamically injected into editors
 */
export interface InjectableComponent {
  /**
   * Unique identifier for the component type
   */
  id: string;

  /**
   * Display name for the component
   */
  name: string;

  /**
   * Description of what the component does
   */
  description?: string;

  /**
   * The Angular component class
   */
  component: Type<unknown>;

  /**
   * Initial data to pass to the component
   */
  data?: Record<string, unknown>;

  /**
   * Category for organizing components
   */
  category?: string;

  /**
   * Icon identifier for UI display
   */
  icon?: string;
}

/**
 * Interface for managing injected component instances
 */
export interface InjectedComponentInstance {
  /**
   * Unique instance identifier
   */
  instanceId: string;

  /**
   * Reference to the component definition
   */
  componentDef: InjectableComponent;

  /**
   * Angular component reference
   */
  componentRef: ComponentRef<unknown>;

  /**
   * Position information within the editor
   */
  position?: {
    index: number;
    node?: unknown;
  };

  /**
   * Current component data
   */
  data?: Record<string, unknown>;
}

/**
 * Interface for component injection events
 */
export interface ComponentInjectionEvent {
  type: 'added' | 'removed' | 'updated' | 'moved';
  instance: InjectedComponentInstance;
  oldData?: Record<string, unknown>;
  newPosition?: number;
}

/**
 * Interface for the component injection API
 */
export interface ComponentInjectionAPI {
  /**
   * Register a new component type
   */
  registerComponent(component: InjectableComponent): void;

  /**
   * Unregister a component type
   */
  unregisterComponent(componentId: string): void;

  /**
   * Get all registered components
   */
  getRegisteredComponents(): InjectableComponent[];

  /**
   * Get registered components by category
   */
  getComponentsByCategory(category: string): InjectableComponent[];

  /**
   * Inject a component into the editor
   */
  injectComponent(
    componentId: string,
    data?: Record<string, unknown>,
    position?: number
  ): Promise<InjectedComponentInstance>;

  /**
   * Remove a component instance
   */
  removeComponent(instanceId: string): void;

  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: Record<string, unknown>): void;

  /**
   * Get all active component instances
   */
  getActiveComponents(): InjectedComponentInstance[];

  /**
   * Get a specific component instance
   */
  getComponent(instanceId: string): InjectedComponentInstance | undefined;

  /**
   * Move a component to a new position
   */
  moveComponent(instanceId: string, newPosition: number): void;
}
