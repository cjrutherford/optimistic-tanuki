import { Injectable, ComponentRef, ViewContainerRef, EventEmitter } from '@angular/core';
import { 
  InjectableComponent, 
  InjectedComponentInstance, 
  ComponentInjectionEvent,
  ComponentInjectionAPI 
} from '../interfaces/component-injection.interface';

@Injectable({
  providedIn: 'root'
})
export class ComponentInjectionService implements ComponentInjectionAPI {
  private registeredComponents = new Map<string, InjectableComponent>();
  private activeComponents = new Map<string, InjectedComponentInstance>();
  private viewContainer: ViewContainerRef | null = null;
  
  /**
   * Event emitter for component injection events
   */
  public componentEvents = new EventEmitter<ComponentInjectionEvent>();

  /**
   * Set the view container reference for component injection
   */
  setViewContainer(viewContainer: ViewContainerRef): void {
    this.viewContainer = viewContainer;
  }

  /**
   * Register a new component type
   */
  registerComponent(component: InjectableComponent): void {
    this.registeredComponents.set(component.id, component);
  }

  /**
   * Unregister a component type
   */
  unregisterComponent(componentId: string): void {
    // Remove any active instances of this component type
    const instancesToRemove = Array.from(this.activeComponents.values())
      .filter(instance => instance.componentDef.id === componentId);
    
    instancesToRemove.forEach(instance => {
      this.removeComponent(instance.instanceId);
    });
    
    this.registeredComponents.delete(componentId);
  }

  /**
   * Get all registered components
   */
  getRegisteredComponents(): InjectableComponent[] {
    return Array.from(this.registeredComponents.values());
  }

  /**
   * Get registered components by category
   */
  getComponentsByCategory(category: string): InjectableComponent[] {
    return this.getRegisteredComponents()
      .filter(component => component.category === category);
  }

  /**
   * Inject a component into the editor
   */
  async injectComponent(componentId: string, data?: any, position?: number): Promise<InjectedComponentInstance> {
    if (!this.viewContainer) {
      throw new Error('ViewContainer not set. Call setViewContainer first.');
    }

    const componentDef = this.registeredComponents.get(componentId);
    if (!componentDef) {
      throw new Error(`Component with id '${componentId}' not found.`);
    }

    // Generate unique instance ID
    const instanceId = `${componentId}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create component instance
    const componentRef = this.viewContainer.createComponent(componentDef.component);

    // Set initial data if provided
    if (data || componentDef.data) {
      const componentData = { ...componentDef.data, ...data };
      Object.keys(componentData).forEach(key => {
        if (componentRef.instance[key] !== undefined) {
          componentRef.instance[key] = componentData[key];
        }
      });
    }

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef,
      position: position !== undefined ? { index: position } : undefined,
      data: { ...componentDef.data, ...data }
    };

    // Store the instance
    this.activeComponents.set(instanceId, instance);

    // Move to specific position if requested
    if (position !== undefined) {
      this.moveComponentToPosition(componentRef, position);
    }

    // Emit event
    this.componentEvents.emit({
      type: 'added',
      instance
    });

    return instance;
  }

  /**
   * Remove a component instance
   */
  removeComponent(instanceId: string): void {
    const instance = this.activeComponents.get(instanceId);
    if (!instance) {
      return;
    }

    // Destroy the component
    instance.componentRef.destroy();

    // Remove from active components
    this.activeComponents.delete(instanceId);

    // Emit event
    this.componentEvents.emit({
      type: 'removed',
      instance
    });
  }

  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: any): void {
    const instance = this.activeComponents.get(instanceId);
    if (!instance) {
      throw new Error(`Component instance '${instanceId}' not found.`);
    }

    const oldData = { ...instance.data };

    // Update instance data
    instance.data = { ...instance.data, ...data };

    // Update component properties
    Object.keys(data).forEach(key => {
      if (instance.componentRef.instance[key] !== undefined) {
        instance.componentRef.instance[key] = data[key];
      }
    });

    // Trigger change detection
    instance.componentRef.changeDetectorRef.detectChanges();

    // Emit event
    this.componentEvents.emit({
      type: 'updated',
      instance,
      oldData
    });
  }

  /**
   * Get all active component instances
   */
  getActiveComponents(): InjectedComponentInstance[] {
    return Array.from(this.activeComponents.values());
  }

  /**
   * Get a specific component instance
   */
  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.activeComponents.get(instanceId);
  }

  /**
   * Move a component to a new position
   */
  moveComponent(instanceId: string, newPosition: number): void {
    const instance = this.activeComponents.get(instanceId);
    if (!instance) {
      throw new Error(`Component instance '${instanceId}' not found.`);
    }

    const oldPosition = instance.position?.index;
    
    this.moveComponentToPosition(instance.componentRef, newPosition);
    
    // Update position
    instance.position = { index: newPosition };

    // Emit event
    this.componentEvents.emit({
      type: 'moved',
      instance,
      newPosition
    });
  }

  /**
   * Clear all components
   */
  clearAllComponents(): void {
    const instances = Array.from(this.activeComponents.keys());
    instances.forEach(instanceId => this.removeComponent(instanceId));
  }

  /**
   * Private helper to move component to specific position in view container
   */
  private moveComponentToPosition(componentRef: ComponentRef<any>, position: number): void {
    if (!this.viewContainer) {
      return;
    }

    const currentIndex = this.viewContainer.indexOf(componentRef.hostView);
    if (currentIndex !== -1) {
      this.viewContainer.move(componentRef.hostView, position);
    }
  }
}