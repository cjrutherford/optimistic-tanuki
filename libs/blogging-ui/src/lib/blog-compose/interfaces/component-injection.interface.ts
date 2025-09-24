import { ComponentRef, Type, ViewContainerRef } from '@angular/core';

/**
 * Interface for components that can be injected into the blog editor
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
  component: Type<any>;
  
  /**
   * Initial data to pass to the component
   */
  data?: any;
  
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
  componentRef: ComponentRef<any>;
  
  /**
   * Position information within the editor
   */
  position?: {
    index: number;
    node?: any;
  };
  
  /**
   * Current component data
   */
  data?: any;
}

/**
 * Interface for component injection events
 */
export interface ComponentInjectionEvent {
  type: 'added' | 'removed' | 'updated' | 'moved';
  instance: InjectedComponentInstance;
  oldData?: any;
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
  injectComponent(componentId: string, data?: any, position?: number): Promise<InjectedComponentInstance>;
  
  /**
   * Remove a component instance
   */
  removeComponent(instanceId: string): void;
  
  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: any): void;
  
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