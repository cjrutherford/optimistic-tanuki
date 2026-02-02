import {
  Injectable,
  ComponentRef,
  ViewContainerRef,
  EventEmitter,
  signal,
  computed,
  Injector,
  ApplicationRef,
} from '@angular/core';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionEvent,
  ComponentInjectionAPI,
} from '../interfaces/component-injection.interface';
import { ComponentWrapperComponent } from '../components/component-wrapper.component';

@Injectable({
  providedIn: 'root',
})
export class ComponentInjectionService implements ComponentInjectionAPI {
  private registeredComponents = signal(new Map<string, InjectableComponent>());
  private activeComponents = signal(new Map<string, InjectedComponentInstance>());
  private viewContainer = signal<ViewContainerRef | null>(null);

  // Computed signals for derived state
  public registeredComponentsList = computed(() => Array.from(this.registeredComponents().values()));
  public activeComponentsList = computed(() => Array.from(this.activeComponents().values()));

  // Callback functions for wrapper events
  private onEditCallback?: (instance: InjectedComponentInstance) => void;
  private onDeleteCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveUpCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveDownCallback?: (instance: InjectedComponentInstance) => void;
  private onSelectionCallback?: (instance: InjectedComponentInstance) => void;
  private onPropertiesChangedCallback?: (instance: InjectedComponentInstance, data: Record<string, any>) => void;

  /**
   * Event emitter for component injection events
   */
  public componentEvents = new EventEmitter<ComponentInjectionEvent>();

  constructor(
    private appRef: ApplicationRef,
    private injector: Injector
  ) {}

  /**
   * Set the view container reference for component injection
   */
  setViewContainer(viewContainer: ViewContainerRef): void {
    console.log('[BlogComponentInjectionService] Setting view container');
    this.viewContainer.set(viewContainer);
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
    onPropertiesChanged?: (instance: InjectedComponentInstance, data: Record<string, any>) => void;
  }): void {
    this.onEditCallback = callbacks.onEdit;
    this.onDeleteCallback = callbacks.onDelete;
    this.onMoveUpCallback = callbacks.onMoveUp;
    this.onMoveDownCallback = callbacks.onMoveDown;
    this.onSelectionCallback = callbacks.onSelection;
    this.onPropertiesChangedCallback = callbacks.onPropertiesChanged;
  }

  /**
   * Register a new component type
   */
  registerComponent(component: InjectableComponent): void {
    console.log('[BlogComponentInjectionService] Registering component:', component.id);
    this.registeredComponents.update(components => {
      const newComponents = new Map(components);
      newComponents.set(component.id, component);
      return newComponents;
    });
  }

  /**
   * Unregister a component type
   */
  unregisterComponent(componentId: string): void {
    console.log('[BlogComponentInjectionService] Unregistering component:', componentId);
    // Remove any active instances of this component type
    const instancesToRemove = this.activeComponentsList().filter(
      (instance) => instance.componentDef.id === componentId
    );

    instancesToRemove.forEach((instance) => {
      this.removeComponent(instance.instanceId);
    });

    this.registeredComponents.update(components => {
      const newComponents = new Map(components);
      newComponents.delete(componentId);
      return newComponents;
    });
  }

  /**
   * Get all registered components
   */
  getRegisteredComponents(): InjectableComponent[] {
    return this.registeredComponentsList();
  }

  /**
   * Get registered components by category
   */
  getComponentsByCategory(category: string): InjectableComponent[] {
    return this.registeredComponentsList().filter(
      (component) => component.category === category
    );
  }

  /**
   * Inject a component into the editor
   */
  async injectComponent(
    componentId: string,
    data?: any,
    position?: number
  ): Promise<InjectedComponentInstance> {
    console.log('[BlogComponentInjectionService] Starting component injection workflow:', { componentId, position });

    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      console.error('[BlogComponentInjectionService] ViewContainer not set');
      throw new Error('ViewContainer not set. Call setViewContainer first.');
    }

    const componentDef = this.registeredComponents().get(componentId);
    if (!componentDef) {
      console.error('[BlogComponentInjectionService] Component not found:', componentId);
      throw new Error(`Component with id '${componentId}' not found.`);
    }

    // Generate unique instance ID
    const instanceId = `${componentId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    console.log('[BlogComponentInjectionService] Generated instance ID:', instanceId);

    // Create wrapper component
    console.log('[BlogComponentInjectionService] Creating wrapper component');
    const wrapperRef = viewContainer.createComponent(
      ComponentWrapperComponent
    );

    // Create the actual component within the wrapper
    console.log('[BlogComponentInjectionService] Creating target component:', componentDef.component.name);
    const componentRef = viewContainer.createComponent(
      componentDef.component
    );

    // Set initial data if provided
    if (data || componentDef.data) {
      console.log('[BlogComponentInjectionService] Setting component data');
      const componentData = { ...componentDef.data, ...data };
      Object.keys(componentData).forEach((key) => {
        if (componentRef.instance[key] !== undefined) {
          componentRef.instance[key] = componentData[key];
        }
      });
    }

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: wrapperRef, // Store wrapper ref as main ref
      position: position !== undefined ? { index: position } : undefined,
      data: { ...componentDef.data, ...data },
    };

    // CRITICAL FIX: Set the component instance BEFORE subscribing to events
    console.log('[BlogComponentInjectionService] Setting component instance');
    wrapperRef.instance.componentInstance = instance;

    console.log('[BlogComponentInjectionService] Setting up event subscriptions for instance:', instanceId);

    // Set up wrapper event handlers with null safety checks
    if (wrapperRef.instance?.editRequested) {
      wrapperRef.instance.editRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          console.log('[BlogComponentInjectionService] Edit properties workflow started for:', inst?.instanceId);
          this.onEditCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.deleteRequested) {
      wrapperRef.instance.deleteRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          console.log('[BlogComponentInjectionService] Delete requested for:', inst?.instanceId);
          this.onDeleteCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.moveUpRequested) {
      wrapperRef.instance.moveUpRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          console.log('[BlogComponentInjectionService] Move up requested for:', inst?.instanceId);
          this.onMoveUpCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.moveDownRequested) {
      wrapperRef.instance.moveDownRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          console.log('[BlogComponentInjectionService] Move down requested for:', inst?.instanceId);
          this.onMoveDownCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.selectionChanged) {
      wrapperRef.instance.selectionChanged.subscribe(
        (inst: InjectedComponentInstance) => {
          console.log('[BlogComponentInjectionService] Selection changed for:', inst?.instanceId);
          this.onSelectionCallback?.(inst);
        }
      );
    }

    // Subscribe to wrapper events with null safety checks
    if (wrapperRef.instance?.propertiesChanged) {
      wrapperRef.instance.propertiesChanged.subscribe(
        (event: { instance: InjectedComponentInstance; data: Record<string, any> }) => {
          console.log('[BlogComponentInjectionService] Edit properties workflow - data changed for:', event?.instance?.instanceId, event.data);
          this.onPropertiesChangedCallback?.(event.instance, event.data);
        }
      );
    }

    // Append the actual component to the wrapper
    console.log('[BlogComponentInjectionService] Appending component to wrapper');
    const wrapperElement = wrapperRef.location.nativeElement;
    const componentElement = componentRef.location.nativeElement;
    wrapperElement.appendChild(componentElement);

    // Store the instance (with additional reference to the inner component)
    instance.data._innerComponentRef = componentRef;
    console.log('[BlogComponentInjectionService] Adding instance to active components');
    this.activeComponents.update(components => {
      const newComponents = new Map(components);
      newComponents.set(instanceId, instance);
      return newComponents;
    });

    // Move to specific position if requested
    if (position !== undefined) {
      this.moveComponentToPosition(wrapperRef, position);
    }

    // Emit event
    this.componentEvents.emit({
      type: 'added',
      instance,
    });

    return instance;
  }

  /**
   * Render a component into a specific DOM element using CDK Portal
   * This version creates both a wrapper and the target component using portals
   */
  renderComponentInto(
    componentId: string,
    instanceId: string,
    data: any,
    targetElement: HTMLElement
  ): InjectedComponentInstance {
    console.log('[BlogComponentInjectionService] Rendering component into element with CDK Portal:', { componentId, instanceId });

    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      console.error('[BlogComponentInjectionService] ViewContainer not set for renderComponentInto');
      throw new Error('ViewContainer not set. Call setViewContainer first.');
    }

    const componentDef = this.registeredComponents().get(componentId);
    if (!componentDef) {
      console.error('[BlogComponentInjectionService] Component not found for rendering:', componentId);
      throw new Error(`Component with id '${componentId}' not found.`);
    }

    // Create wrapper portal and outlet
    console.log('[BlogComponentInjectionService] Creating wrapper portal');
    const wrapperPortal = new ComponentPortal(
      ComponentWrapperComponent,
      null,
      this.injector
    );

    const wrapperOutlet = new DomPortalOutlet(
      targetElement,
      null, // ComponentFactoryResolver deprecated in Angular 20
      this.appRef,
      this.injector
    );

    const wrapperRef = wrapperOutlet.attach(wrapperPortal);

    // Create the actual component portal
    console.log('[BlogComponentInjectionService] Creating target component portal');
    const componentPortal = new ComponentPortal(
      componentDef.component,
      null,
      this.injector
    );

    // Get the wrapper's DOM element and create an outlet for the component
    const wrapperElement = wrapperRef.location.nativeElement;
    const componentContainer = wrapperElement.querySelector('.component-wrapper') || wrapperElement;
    
    const componentOutlet = new DomPortalOutlet(
      componentContainer,
      null, // ComponentFactoryResolver deprecated in Angular 20
      this.appRef,
      this.injector
    );

    const componentRef = componentOutlet.attach(componentPortal);

    // Set initial data if provided
    if (data || componentDef.data) {
      const componentData = { ...componentDef.data, ...data };
      Object.keys(componentData).forEach((key) => {
        if (componentRef.instance[key] !== undefined) {
          componentRef.instance[key] = componentData[key];
        }
      });
    }

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: wrapperRef, // Store wrapper ref as main ref
      data: { ...componentDef.data, ...data },
      portalOutlet: wrapperOutlet // Store the main outlet for cleanup
    };

    // Configure wrapper component
    wrapperRef.instance.componentInstance = instance;

    // Set up wrapper event handlers with null safety checks
    if (wrapperRef.instance?.editRequested) {
      wrapperRef.instance.editRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          this.onEditCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.deleteRequested) {
      wrapperRef.instance.deleteRequested.subscribe(
        (inst: InjectedComponentInstance) => {
          this.onDeleteCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.selectionChanged) {
      wrapperRef.instance.selectionChanged.subscribe(
        (inst: InjectedComponentInstance) => {
          this.onSelectionCallback?.(inst);
        }
      );
    }

    if (wrapperRef.instance?.propertiesChanged) {
      wrapperRef.instance.propertiesChanged.subscribe(
        (event: { instance: InjectedComponentInstance; data: Record<string, any> }) => {
          this.onPropertiesChangedCallback?.(event.instance, event.data);
        }
      );
    }

    // Store the instance (with additional reference to the inner component and outlet)
    instance.data._innerComponentRef = componentRef;
    instance.data._componentOutlet = componentOutlet;
    
    console.log('[BlogComponentInjectionService] Adding render instance to active components');
    this.activeComponents.update(components => {
      const newComponents = new Map(components);
      newComponents.set(instanceId, instance);
      return newComponents;
    });

    // Trigger change detection
    componentRef.changeDetectorRef.detectChanges();
    wrapperRef.changeDetectorRef.detectChanges();

    console.log('[BlogComponentInjectionService] Component rendered via CDK Portal with wrapper');

    return instance;
  }

  /**
   * Get a component instance by ID
   */
  getInstance(instanceId: string): InjectedComponentInstance | undefined {
    return this.activeComponents().get(instanceId);
  }

  /**
   * Remove a component instance
   */
  removeComponent(instanceId: string): void {
    console.log('[BlogComponentInjectionService] Starting component removal workflow:', instanceId);

    const instance = this.activeComponents().get(instanceId);
    if (!instance) {
      console.warn('[BlogComponentInjectionService] Instance not found for removal:', instanceId);
      return;
    }

    console.log('[BlogComponentInjectionService] Destroying component instance');
    
    // Clean up inner component outlet if exists
    if (instance.data?._componentOutlet) {
      instance.data._componentOutlet.detach();
      instance.data._componentOutlet.dispose();
      console.log('[BlogComponentInjectionService] Inner component outlet disposed');
    }
    
    // Clean up inner component ref if exists
    if (instance.data?._innerComponentRef) {
      instance.data._innerComponentRef.destroy();
    }
    
    // If using CDK Portal, detach and dispose the portal outlet
    if (instance.portalOutlet) {
      instance.portalOutlet.detach();
      instance.portalOutlet.dispose();
      console.log('[BlogComponentInjectionService] Main portal outlet disposed');
    }
    
    // Destroy the component
    instance.componentRef?.destroy();

    // Remove from active components
    console.log('[BlogComponentInjectionService] Removing from active components');
    this.activeComponents.update(components => {
      const newComponents = new Map(components);
      newComponents.delete(instanceId);
      return newComponents;
    });

    // Emit event
    console.log('[BlogComponentInjectionService] Emitting component removed event');
    this.componentEvents.emit({
      type: 'removed',
      instance,
    });

    console.log('[BlogComponentInjectionService] Component removal workflow completed:', instanceId);
  }

  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: any): void {
    console.log('[BlogComponentInjectionService] Starting edit properties workflow - component update:', { instanceId, data });

    const instance = this.activeComponents().get(instanceId);
    if (!instance) {
      console.error('[BlogComponentInjectionService] Edit properties workflow failed - instance not found:', instanceId);
      throw new Error(`Component instance '${instanceId}' not found.`);
    }

    const oldData = { ...instance.data };
    console.log('[BlogComponentInjectionService] Edit properties workflow - previous data:', oldData);

    // Update instance data
    instance.data = { ...instance.data, ...data };
    console.log('[BlogComponentInjectionService] Edit properties workflow - updated data:', instance.data);

    // Update component properties
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerRef = (instance.data as any)._innerComponentRef;
    const targetRef = innerRef || instance.componentRef;
    console.log('[BlogComponentInjectionService] Edit properties workflow - updating component properties');

    Object.keys(data).forEach((key) => {
      if (
        key !== '_innerComponentRef' &&
        targetRef.instance &&
        targetRef.instance[key] !== undefined
      ) {
        console.log(`[BlogComponentInjectionService] Edit properties workflow - updating property ${key}:`, data[key]);
        targetRef.instance[key] = data[key];
      }
    });

    // Trigger change detection
    console.log('[BlogComponentInjectionService] Edit properties workflow - triggering change detection');
    if (innerRef && innerRef.changeDetectorRef) {
      innerRef.changeDetectorRef.detectChanges();
    }
    instance.componentRef.changeDetectorRef.detectChanges();

    // Emit event
    console.log('[BlogComponentInjectionService] Edit properties workflow - emitting update event');
    this.componentEvents.emit({
      type: 'updated',
      instance,
      oldData,
    });

    console.log('[BlogComponentInjectionService] Edit properties workflow completed successfully:', instanceId);
  }

  /**
   * Get all active component instances
   */
  getActiveComponents(): InjectedComponentInstance[] {
    return this.activeComponentsList();
  }

  /**
   * Get a specific component instance
   */
  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.activeComponents().get(instanceId);
  }

  /**
   * Move a component to a new position
   */
  moveComponent(instanceId: string, newPosition: number): void {
    console.log('[BlogComponentInjectionService] Starting component move workflow:', { instanceId, newPosition });

    const instance = this.activeComponents().get(instanceId);
    if (!instance) {
      console.error('[BlogComponentInjectionService] Instance not found for move:', instanceId);
      throw new Error(`Component instance '${instanceId}' not found.`);
    }

    const oldPosition = instance.position?.index;
    console.log('[BlogComponentInjectionService] Moving from position:', oldPosition, 'to:', newPosition);

    this.moveComponentToPosition(instance.componentRef, newPosition);

    // Update position
    instance.position = { index: newPosition };
    console.log('[BlogComponentInjectionService] Updated position to:', newPosition);

    // Emit event
    console.log('[BlogComponentInjectionService] Emitting component moved event');
    this.componentEvents.emit({
      type: 'moved',
      instance,
      newPosition,
    });

    console.log('[BlogComponentInjectionService] Component move workflow completed:', instanceId);
  }

  /**
   * Clear all components
   */
  clearAllComponents(): void {
    console.log('[BlogComponentInjectionService] Clearing all components');
    const instances = this.activeComponentsList().map(instance => instance.instanceId);
    instances.forEach((instanceId) => this.removeComponent(instanceId));
  }

  /**
   * Private helper to move component to specific position in view container
   */
  private moveComponentToPosition(
    componentRef: ComponentRef<any>,
    position: number
  ): void {
    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      console.warn('[BlogComponentInjectionService] ViewContainer not available for move operation');
      return;
    }

    const currentIndex = viewContainer.indexOf(componentRef.hostView);
    if (currentIndex !== -1) {
      console.log('[BlogComponentInjectionService] Moving component from index:', currentIndex, 'to:', position);
      viewContainer.move(componentRef.hostView, position);
    }
  }
}
