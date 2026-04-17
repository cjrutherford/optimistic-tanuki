import {
  Injectable,
  ComponentRef,
  ViewContainerRef,
  EventEmitter,
} from '@angular/core';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionEvent,
  ComponentInjectionAPI,
} from '../interfaces/component-injection.interface';
import { ComponentEditorWrapperComponent } from '@optimistic-tanuki/compose-lib';

@Injectable({
  providedIn: 'root',
})
export class ComponentInjectionService implements ComponentInjectionAPI {
  private registeredComponents = new Map<string, InjectableComponent>();
  private activeComponents = new Map<string, InjectedComponentInstance>();
  private viewContainer: ViewContainerRef | null = null;

  // Callback functions for wrapper events
  private onEditCallback?: (instance: InjectedComponentInstance) => void;
  private onDeleteCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveUpCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveDownCallback?: (instance: InjectedComponentInstance) => void;
  private onSelectionCallback?: (instance: InjectedComponentInstance) => void;
  private onDuplicateCallback?: (instance: InjectedComponentInstance) => void;
  private onConfigCallback?: (instance: InjectedComponentInstance) => void;
  private onPropertiesChangedCallback?: (data: {
    instance: InjectedComponentInstance;
    data: Record<string, unknown>;
  }) => void;

  /**
   * Event emitter for component injection events
   */
  public componentEvents = new EventEmitter<ComponentInjectionEvent>();

  /**
   * Set the view container reference for component injection
   */
  setViewContainer(viewContainer: ViewContainerRef): void {
    console.log('view container set');
    this.viewContainer = viewContainer;
  }

  /**
   * Set callback functions for wrapper events
   */
  setWrapperCallbacks(callbacks: {
    onEdit?: (instance: InjectedComponentInstance) => void;
    onDelete?: (instance: InjectedComponentInstance) => void;
    onMoveUp?: (instance: InjectedComponentInstance) => void;
    onMoveDown?: (instance: InjectedComponentInstance) => void;
    onSelection?: (instance: InjectedComponentInstance) => void;
    onDuplicate?: (instance: InjectedComponentInstance) => void;
    onConfig?: (instance: InjectedComponentInstance) => void;
    onPropertiesChanged?: (data: {
      instance: InjectedComponentInstance;
      data: Record<string, unknown>;
    }) => void;
  }): void {
    this.onEditCallback = callbacks.onEdit;
    this.onDeleteCallback = callbacks.onDelete;
    this.onMoveUpCallback = callbacks.onMoveUp;
    this.onMoveDownCallback = callbacks.onMoveDown;
    this.onSelectionCallback = callbacks.onSelection;
    this.onDuplicateCallback = callbacks.onDuplicate;
    this.onConfigCallback = callbacks.onConfig;
    this.onPropertiesChangedCallback = callbacks.onPropertiesChanged;
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
    const instancesToRemove = Array.from(this.activeComponents.values()).filter(
      (instance) => instance.componentDef.id === componentId
    );

    instancesToRemove.forEach((instance) => {
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
    return this.getRegisteredComponents().filter(
      (component) => component.category === category
    );
  }

  /**
   * Inject a component into the editor
   */
  async injectComponent(
    componentId: string,
    data?: Record<string, unknown>,
    position?: number
  ): Promise<InjectedComponentInstance> {
    if (!this.viewContainer) {
      throw new Error('ViewContainer not set. Call setViewContainer first.');
    }

    const componentDef = this.registeredComponents.get(componentId);
    if (!componentDef) {
      throw new Error(`Component with id '${componentId}' not found.`);
    }

    // Generate unique instance ID
    const instanceId = `${componentId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // Create wrapper component - the wrapper will create the inner component itself
    const wrapperRef =
      position !== undefined
        ? this.viewContainer.createComponent(ComponentEditorWrapperComponent, {
            index: position,
          })
        : this.viewContainer.createComponent(ComponentEditorWrapperComponent);

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: wrapperRef, // Store wrapper ref as main ref
      position: position !== undefined ? { index: position } : undefined,
      data: { ...(componentDef.data || {}), ...(data || {}) },
    };

    // Configure wrapper component - it will create the inner component itself
    wrapperRef.instance.componentInstance = instance;
    wrapperRef.instance.componentDef = componentDef;
    wrapperRef.instance.componentData = {
      ...(componentDef.data || {}),
      ...(data || {}),
    };

    // Set up wrapper event handlers
    wrapperRef.instance.deleteRequested.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onDeleteCallback?.(inst);
      }
    );

    wrapperRef.instance.duplicateRequested.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onDuplicateCallback?.(inst);
      }
    );

    wrapperRef.instance.selectionChanged.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onSelectionCallback?.(inst);
      }
    );

    wrapperRef.instance.propertiesChanged.subscribe(
      (data: {
        instance: InjectedComponentInstance;
        data: Record<string, unknown>;
      }) => {
        this.onPropertiesChangedCallback?.(data);
      }
    );

    // Store the instance
    this.activeComponents.set(instanceId, instance);

    // Emit event
    this.componentEvents.emit({
      type: 'added',
      instance,
    });

    return instance;
  }

  /**
   * Render a component into a specific DOM element
   */
  renderComponentInto(
    componentId: string,
    instanceId: string,
    data: Record<string, unknown>,
    targetElement: HTMLElement
  ): InjectedComponentInstance {
    if (!this.viewContainer) {
      throw new Error('ViewContainer not set. Call setViewContainer first.');
    }

    const componentDef = this.registeredComponents.get(componentId);
    if (!componentDef) {
      throw new Error(`Component with id '${componentId}' not found.`);
    }

    // Create wrapper component - the wrapper will create the inner component itself
    const wrapperRef = this.viewContainer.createComponent(
      ComponentEditorWrapperComponent
    );

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: wrapperRef, // Store wrapper ref as main ref
      data: { ...(componentDef.data || {}), ...(data || {}) },
    };

    // Configure wrapper component - it will create the inner component itself
    wrapperRef.instance.componentInstance = instance;
    wrapperRef.instance.componentDef = componentDef;
    wrapperRef.instance.componentData = {
      ...(componentDef.data || {}),
      ...(data || {}),
    };

    // Set up wrapper event handlers
    wrapperRef.instance.deleteRequested.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onDeleteCallback?.(inst);
      }
    );

    wrapperRef.instance.duplicateRequested.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onDuplicateCallback?.(inst);
      }
    );

    wrapperRef.instance.selectionChanged.subscribe(
      (inst: InjectedComponentInstance) => {
        this.onSelectionCallback?.(inst);
      }
    );

    wrapperRef.instance.propertiesChanged.subscribe(
      (data: {
        instance: InjectedComponentInstance;
        data: Record<string, unknown>;
      }) => {
        this.onPropertiesChangedCallback?.(data);
      }
    );

    // Append wrapper to target element
    const wrapperElement = wrapperRef.location.nativeElement;
    targetElement.appendChild(wrapperElement);

    // Store the instance
    this.activeComponents.set(instanceId, instance);

    return instance;
  }

  /**
   * Get a component instance by ID
   */
  getInstance(instanceId: string): InjectedComponentInstance | undefined {
    return this.activeComponents.get(instanceId);
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
      instance,
    });
  }

  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: Record<string, unknown>): void {
    const instance = this.activeComponents.get(instanceId);
    if (!instance) {
      throw new Error(`Component instance '${instanceId}' not found.`);
    }

    const oldData = { ...(instance.data || {}) };

    // Update instance data
    instance.data = { ...(instance.data || {}), ...data };

    // Update wrapper component's data
    const wrapperInstance = instance.componentRef
      .instance as ComponentEditorWrapperComponent;
    if (wrapperInstance) {
      // Use the public updateComponentData method if available
      if (typeof wrapperInstance.updateComponentData === 'function') {
        wrapperInstance.updateComponentData(data);
      } else {
        // Fallback to direct property update
        if (wrapperInstance.componentData) {
          wrapperInstance.componentData = {
            ...wrapperInstance.componentData,
            ...data,
          };
        }
      }
    }

    // Trigger change detection
    instance.componentRef.changeDetectorRef.detectChanges();

    // Emit event
    this.componentEvents.emit({
      type: 'updated',
      instance,
      oldData,
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

    // Position tracking handled by TipTap

    this.moveComponentToPosition(instance.componentRef, newPosition);

    // Update position
    instance.position = { index: newPosition };

    // Emit event
    this.componentEvents.emit({
      type: 'moved',
      instance,
      newPosition,
    });
  }

  /**
   * Clear all components
   */
  clearAllComponents(): void {
    const instances = Array.from(this.activeComponents.keys());
    instances.forEach((instanceId) => this.removeComponent(instanceId));
  }

  /**
   * Private helper to move component to specific position in view container
   */
  private moveComponentToPosition(
    componentRef: ComponentRef<unknown>,
    position: number
  ): void {
    if (!this.viewContainer) {
      return;
    }

    const currentIndex = this.viewContainer.indexOf(componentRef.hostView);
    if (currentIndex !== -1) {
      this.viewContainer.move(componentRef.hostView, position);
    }
  }
}
