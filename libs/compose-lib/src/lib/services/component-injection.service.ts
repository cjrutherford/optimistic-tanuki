import {
  Injectable,
  ComponentRef,
  ViewContainerRef,
  EventEmitter,
  signal,
  computed,
  effect,
  Injector,
  ApplicationRef,
  ComponentFactoryResolver,
  EnvironmentInjector,
} from '@angular/core';
import { ComponentPortal, DomPortalOutlet } from '@angular/cdk/portal';
import {
  InjectableComponent,
  InjectedComponentInstance,
  ComponentInjectionEvent,
  ComponentInjectionAPI,
} from '../interfaces/component-injection.interface';
import { ComponentWrapperComponent } from '../components/component-wrapper.component';
import {
  ComponentInjectionStateManager,
  ComponentAction,
  ComponentInjectionState
} from '../state/component-injection-state';
import { UnifiedComponentRegistryService } from './unified-component-registry.service';
import { TipTapIntegrationService } from './tiptap-integration.service';

@Injectable({
  providedIn: 'root',
})
export class ComponentInjectionService implements ComponentInjectionAPI {
  // State management using reducer pattern
  private stateManager = new ComponentInjectionStateManager();

  // Public computed signals for reactive UI
  public registeredComponents = this.stateManager.registeredComponents;
  public activeComponents = this.stateManager.activeComponents;
  public selectedInstance = this.stateManager.selectedInstance;
  public isPropertyEditorVisible = this.stateManager.isPropertyEditorVisible;
  public componentsByCategory = this.stateManager.componentsByCategory;

  // Legacy computed signals for backwards compatibility
  public registeredComponentsList = this.stateManager.registeredComponents;
  public activeComponentsList = this.stateManager.activeComponents;

  // Enhanced logging - track all state changes
  private loggingEffect = effect(() => {
    const state = this.stateManager.getState();
    console.log('[ComponentInjectionService] State updated:', {
      registeredCount: state.registeredComponents.size,
      activeCount: state.activeComponents.size,
      selectedInstanceId: state.selectedInstanceId,
      isPropertyEditorVisible: state.isPropertyEditorVisible,
      timestamp: state.lastActionTimestamp,
    });
  });

  // ViewContainer signal
  private viewContainer = signal<ViewContainerRef | null>(null);

  // Event emitter for component injection events
  public componentEvents = new EventEmitter<ComponentInjectionEvent>();

  // Callback functions for wrapper events
  private onEditCallback?: (instance: InjectedComponentInstance) => void;
  private onDeleteCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveUpCallback?: (instance: InjectedComponentInstance) => void;
  private onMoveDownCallback?: (instance: InjectedComponentInstance) => void;
  private onSelectionCallback?: (instance: InjectedComponentInstance) => void;
  private onPropertiesChangedCallback?: (instance: InjectedComponentInstance, data: Record<string, any>) => void;

  // TipTap integration callbacks
  private tiptapRenderer?: (componentId: string, instanceId: string, data: any, container: HTMLElement) => InjectedComponentInstance | undefined;
  private tiptapUpdateCallback?: (instanceId: string, data: Record<string, any>) => void;
  private tiptapRemoveCallback?: (instanceId: string) => void;

  constructor(
    private unifiedRegistry: UnifiedComponentRegistryService,
    private tipTapIntegration: TipTapIntegrationService,
    private appRef: ApplicationRef,
    private injector: Injector
  ) {
    // Set up TipTap integration callbacks
    this.setupTipTapIntegration();
  }

  /**
   * Set up TipTap integration with the unified registry
   */
  private setupTipTapIntegration(): void {
    // Only setup TipTap integration if we have a view container
    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      console.warn('[ComponentInjectionService] Cannot setup TipTap integration - no view container');
      return;
    }

    // Create TipTap callbacks using the integration service
    this.tiptapRenderer = this.tipTapIntegration.createComponentRenderer(
      viewContainer,
      (instance, element) => {
        console.log('[ComponentInjectionService] TipTap component created:', instance.instanceId);
        // Additional setup for TipTap rendered components
      }
    );

    this.tiptapUpdateCallback = this.tipTapIntegration.createUpdateCallback(
      (instanceId, data) => {
        console.log('[ComponentInjectionService] TipTap component updated:', instanceId);
        // Sync with state manager
        const instance = this.stateManager.getActiveInstance(instanceId);
        if (instance) {
          this.dispatch({ type: 'UPDATE_INSTANCE', instanceId, data });
        }
      }
    );

    this.tiptapRemoveCallback = this.tipTapIntegration.createRemoveCallback(
      (instanceId) => {
        console.log('[ComponentInjectionService] TipTap component removed:', instanceId);
        // Sync with state manager
        this.dispatch({ type: 'REMOVE_INSTANCE', instanceId });
      }
    );
  }

  /**
   * Private method to dispatch actions to the state manager
   */
  private dispatch(action: ComponentAction): void {
    this.stateManager.dispatch(action);

    // Emit events for backwards compatibility
    if (action.type === 'ADD_INSTANCE' || action.type === 'UPDATE_INSTANCE' || action.type === 'REMOVE_INSTANCE') {
      this.emitComponentEvent(action);
    }
  }

  /**
   * Register a component for injection
   */
  registerComponent(component: InjectableComponent, source: string = 'compose-lib'): void {
    // Register with unified registry first
    this.unifiedRegistry.registerComponent(component, source);

    // Then with state manager
    this.dispatch({ type: 'REGISTER_COMPONENT', component });
  }

  /**
   * Register multiple components from a library
   */
  registerComponentsFromLibrary(components: InjectableComponent[], libraryName: string): void {
    console.log(`[ComponentInjectionService] Registering ${components.length} components from ${libraryName}`);

    // Register all with unified registry
    this.unifiedRegistry.registerComponents(components, libraryName);

    // Register with state manager
    components.forEach(component => {
      this.dispatch({ type: 'REGISTER_COMPONENT', component });
    });

    console.log(`[ComponentInjectionService] Successfully registered components from ${libraryName}`);
  }

  /**
   * Unregister a component
   */
  unregisterComponent(componentId: string): void {
    this.dispatch({ type: 'UNREGISTER_COMPONENT', componentId });
  }

  /**
   * Set TipTap integration callbacks
   */
  setTipTapCallbacks(callbacks: {
    renderer?: (componentId: string, instanceId: string, data: any, container: HTMLElement) => InjectedComponentInstance | undefined;
    updateCallback?: (instanceId: string, data: Record<string, any>) => void;
    removeCallback?: (instanceId: string) => void;
  }): void {
    this.tiptapRenderer = callbacks.renderer;
    this.tiptapUpdateCallback = callbacks.updateCallback;
    this.tiptapRemoveCallback = callbacks.removeCallback;
  }

  /**
   * Set the view container reference for component injection
   */
  setViewContainer(viewContainer: ViewContainerRef): void {
    console.log('[ComponentInjectionService] Setting view container');
    this.viewContainer.set(viewContainer);

    // Setup TipTap integration now that we have a view container
    this.setupTipTapIntegration();
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
   * Inject a component into the editor
   */
  async injectComponent(
    componentId: string,
    data?: Record<string, unknown>,
    position?: number
  ): Promise<InjectedComponentInstance> {
    console.log('[ComponentInjectionService] Starting component injection workflow:', { componentId, position });

    // Check if we have TipTap integration or view container
    if (this.tiptapRenderer) {
      console.log('[ComponentInjectionService] Using TipTap integration');
      return this.injectComponentViaTipTap(componentId, data, position);
    }

    // Use ViewContainer injection
    return this.injectComponentViaViewContainer(componentId, data, position);
  }

  /**
   * Inject component via TipTap integration
   */
  private async injectComponentViaTipTap(
    componentId: string,
    data?: Record<string, unknown>,
    position?: number
  ): Promise<InjectedComponentInstance> {
    console.log('[ComponentInjectionService] TipTap injection for:', componentId);

    const componentDef = this.stateManager.getRegisteredComponent(componentId);
    if (!componentDef) {
      throw new Error(`Component ${componentId} not found`);
    }

    const instanceId = `${componentId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    const componentData = { ...componentDef.data, ...data };

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: undefined, // Will be set by TipTap renderer
      position: position !== undefined ? { index: position } : undefined,
      data: componentData,
    };

    // Add to state via reducer
    this.dispatch({ type: 'ADD_INSTANCE', instance });

    // Return the instance - TipTap integration will handle rendering
    return instance;
  }

  /**
   * Inject component via ViewContainer
   */
  private async injectComponentViaViewContainer(
    componentId: string,
    data?: Record<string, unknown>,
    position?: number
  ): Promise<InjectedComponentInstance> {
    console.log('[ComponentInjectionService] ViewContainer injection for:', componentId);

    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      throw new Error('ViewContainer not set. Call setViewContainer() first.');
    }

    const componentDef = this.stateManager.getRegisteredComponent(componentId);
    if (!componentDef) {
      throw new Error(`Component ${componentId} not found`);
    }

    const instanceId = `${componentId}_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;
    console.log('[ComponentInjectionService] Generated instance ID:', instanceId);

    // Create wrapper component
    console.log('[ComponentInjectionService] Creating wrapper component');
    const wrapperRef =
      viewContainer.createComponent<ComponentWrapperComponent>(
        ComponentWrapperComponent
      );

    // Create the actual component within the wrapper
    console.log('[ComponentInjectionService] Creating target component:', componentDef.component.name);
    const componentRef = viewContainer.createComponent(
      componentDef.component
    );

    // Set initial data if provided
    if (data || componentDef.data) {
      console.log('[ComponentInjectionService] Setting component data');
      const componentData = { ...componentDef.data, ...data };
      Object.keys(componentData).forEach((key) => {
        if (
          (componentRef.instance as Record<string, unknown>)[key] !== undefined
        ) {
          (componentRef.instance as Record<string, unknown>)[key] =
            componentData[key];
        }
      });
    }

    // Create instance object
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef,
      componentRef: wrapperRef as ComponentRef<unknown>, // Store wrapper ref as main ref
      position: position !== undefined ? { index: position } : undefined,
      data: { ...componentDef.data, ...data },
    };

    console.log('[ComponentInjectionService] Configuring wrapper component');
    // Configure wrapper component
    wrapperRef.instance.componentInstance = instance;

    // Set up wrapper event handlers
    this.setupWrapperEventHandlers(wrapperRef, instance);

    // Append the actual component to the wrapper
    console.log('[ComponentInjectionService] Appending component to wrapper');
    const wrapperElement = wrapperRef.location.nativeElement;
    const componentElement = componentRef.location.nativeElement;
    wrapperElement.appendChild(componentElement);

    // Add to state via reducer
    this.dispatch({ type: 'ADD_INSTANCE', instance });

    // Handle positioning if specified
    if (position !== undefined) {
      this.moveComponentToPosition(wrapperRef, position);
    }

    console.log('[ComponentInjectionService] Component injection workflow completed:', instanceId);
    return instance;
  }

  /**
   * Set up event handlers for wrapper component
   */
  private setupWrapperEventHandlers(wrapperRef: ComponentRef<ComponentWrapperComponent>, instance: InjectedComponentInstance): void {
    console.log('[ComponentInjectionService] Setting up event handlers');

    wrapperRef.instance.editRequested.subscribe(
      () => {
        console.log('[ComponentInjectionService] Edit requested for:', instance.instanceId);
        this.onEditCallback?.(instance);
      }
    );

    wrapperRef.instance.deleteRequested.subscribe(
      () => {
        console.log('[ComponentInjectionService] Delete requested for:', instance.instanceId);
        this.onDeleteCallback?.(instance);
      }
    );

    wrapperRef.instance.moveUpRequested.subscribe(
      () => {
        console.log('[ComponentInjectionService] Move up requested for:', instance.instanceId);
        this.onMoveUpCallback?.(instance);
      }
    );

    wrapperRef.instance.moveDownRequested.subscribe(
      () => {
        console.log('[ComponentInjectionService] Move down requested for:', instance.instanceId);
        this.onMoveDownCallback?.(instance);
      }
    );

    wrapperRef.instance.selectionChanged.subscribe(
      (isSelected: boolean) => {
        console.log('[ComponentInjectionService] Selection changed for:', instance.instanceId, isSelected);
        if (isSelected) {
          this.onSelectionCallback?.(instance);
        }
      }
    );

    // Subscribe to properties changed event if available
    if ('propertiesChanged' in wrapperRef.instance) {
      (wrapperRef.instance as any).propertiesChanged?.subscribe((data: Record<string, any>) => {
        console.log('[ComponentInjectionService] Properties changed for:', instance.instanceId, data);
        this.onPropertiesChangedCallback?.(instance, data);
      });
    }
  }

  /**
   * Remove a component instance
   */
  removeComponent(instanceId: string): void {
    console.log('[ComponentInjectionService] Starting component removal workflow:', instanceId);

    const instance = this.stateManager.getActiveInstance(instanceId);
    if (!instance) {
      console.warn('[ComponentInjectionService] Instance not found for removal:', instanceId);
      return;
    }

    console.log('[ComponentInjectionService] Destroying component instance');
    
    // If using CDK Portal, detach and dispose the portal outlet
    if (instance.portalOutlet) {
      instance.portalOutlet.detach();
      instance.portalOutlet.dispose();
      console.log('[ComponentInjectionService] Portal outlet disposed');
    }
    
    // Destroy the component
    instance.componentRef?.destroy();

    // Remove from active components via reducer
    console.log('[ComponentInjectionService] Removing from active components via reducer');
    this.dispatch({ type: 'REMOVE_INSTANCE', instanceId });

    // Call TipTap removal callback if available
    if (this.tiptapRemoveCallback) {
      this.tiptapRemoveCallback(instanceId);
    }

    console.log('[ComponentInjectionService] Component removal workflow completed:', instanceId);
  }

  /**
   * Update component data
   */
  updateComponent(instanceId: string, data: Record<string, unknown>): void {
    console.log('[ComponentInjectionService] Starting component update workflow:', { instanceId, data });

    const instance = this.stateManager.getActiveInstance(instanceId);
    if (!instance) {
      console.warn('[ComponentInjectionService] Instance not found for update:', instanceId);
      return;
    }

    const oldData = { ...instance.data };
    console.log('[ComponentInjectionService] Previous data:', oldData);

    // Update state via reducer
    this.dispatch({ type: 'UPDATE_INSTANCE', instanceId, data });

    // Update the actual component instance
    if (instance.componentRef) {
      const componentInstance = instance.componentRef.instance;
      Object.keys(data).forEach((key) => {
        if ((componentInstance as Record<string, unknown>)[key] !== undefined) {
          (componentInstance as Record<string, unknown>)[key] = data[key];
        }
      });

      // Trigger change detection if available
      if (typeof (componentInstance as any).markForCheck === 'function') {
        (componentInstance as any).markForCheck();
      }
    }

    // Call TipTap update callback if available
    if (this.tiptapUpdateCallback) {
      this.tiptapUpdateCallback(instanceId, data);
    }

    console.log('[ComponentInjectionService] Component update workflow completed:', instanceId);
  }

  /**
   * Move component to new position
   */
  moveComponent(instanceId: string, newPosition: number): void {
    console.log('[ComponentInjectionService] Starting component move workflow:', { instanceId, newPosition });

    const instance = this.stateManager.getActiveInstance(instanceId);
    if (!instance) {
      console.warn('[ComponentInjectionService] Instance not found for move:', instanceId);
      return;
    }

    console.log('[ComponentInjectionService] Moving component to position');
    if (instance.componentRef) {
      this.moveComponentToPosition(instance.componentRef, newPosition);
    }

    // Update position in state
    this.dispatch({ type: 'MOVE_INSTANCE', instanceId, newPosition });

    console.log('[ComponentInjectionService] Component move workflow completed:', { instanceId, newPosition });
  }

  /**
   * Select a component instance
   */
  selectComponent(instanceId: string | null): void {
    this.dispatch({ type: 'SELECT_INSTANCE', instanceId });
  }

  /**
   * Set property editor visibility
   */
  setPropertyEditorVisible(visible: boolean): void {
    this.dispatch({ type: 'SET_PROPERTY_EDITOR_VISIBLE', visible });
  }

  /**
   * Private method to emit component events
   */
  private emitComponentEvent(action: ComponentAction): void {
    switch (action.type) {
      case 'ADD_INSTANCE':
        const addedInstance = this.stateManager.getActiveInstance(action.instance.instanceId);
        if (addedInstance) {
          this.componentEvents.emit({
            type: 'added',
            instance: addedInstance
          });
        }
        break;
      case 'UPDATE_INSTANCE':
        const updatedInstance = this.stateManager.getActiveInstance(action.instanceId);
        if (updatedInstance) {
          this.componentEvents.emit({
            type: 'updated',
            instance: updatedInstance
          });
        }
        break;
      case 'REMOVE_INSTANCE':
        // Instance might already be removed from state, so we can't emit the full event
        break;
    }
  }

  /**
   * Private helper to move component to specific position in view container
   */
  private moveComponentToPosition(
    componentRef: ComponentRef<unknown>,
    position: number
  ): void {
    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      console.warn('[ComponentInjectionService] ViewContainer not available for move operation');
      return;
    }

    const currentIndex = viewContainer.indexOf(componentRef.hostView);
    if (currentIndex !== -1) {
      console.log('[ComponentInjectionService] Moving component from index:', currentIndex, 'to:', position);
      viewContainer.move(componentRef.hostView, position);
    }
  }

  // ========== BACKWARD COMPATIBILITY METHODS ==========

  /**
   * Get component instance by ID - backwards compatibility method
   */
  getInstance(instanceId: string): InjectedComponentInstance | undefined {
    return this.stateManager.getComponentInstance(instanceId);
  }

  /**
   * Get component instance by ID
   */
  getComponentInstance(instanceId: string): InjectedComponentInstance | undefined {
    return this.stateManager.getComponentInstance(instanceId);
  }

  /**
   * Get registered components by category - backwards compatibility method
   */
  getComponentsByCategory(category: string): InjectableComponent[] {
    // Use unified registry for more comprehensive results
    return this.unifiedRegistry.getComponentsByCategory(category);
  }

  /**
   * Search components with advanced criteria
   */
  searchComponents(criteria: {
    name?: string;
    category?: string;
    source?: string;
    tags?: string[];
  }): InjectableComponent[] {
    return this.unifiedRegistry.searchComponents(criteria);
  }

  /**
   * Get component registry statistics
   */
  getRegistryStats() {
    return this.unifiedRegistry.getStats();
  }

  /**
   * Get registered components - backwards compatibility method  
   */
  getRegisteredComponents(): InjectableComponent[] {
    return this.registeredComponents();
  }

  /**
   * Get active components - backwards compatibility method
   */
  getActiveComponents(): InjectedComponentInstance[] {
    return this.activeComponents();
  }

  /**
   * Clear all components - backwards compatibility method
   */
  clearAllComponents(): void {
    this.dispatch({ type: 'RESET_STATE' });
  }

  /**
   * Get component by instance ID - backwards compatibility method
   */
  getComponent(instanceId: string): InjectedComponentInstance | undefined {
    return this.getInstance(instanceId);
  }

  /**
   * Render a component into a specific DOM element (for TipTap integration)
   * Uses Angular CDK Portal for clean component lifecycle management
   */
  renderComponentInto(
    componentId: string,
    instanceId: string,
    data: Record<string, unknown>,
    element: HTMLElement
  ): InjectedComponentInstance {
    const viewContainer = this.viewContainer();
    if (!viewContainer) {
      throw new Error('ViewContainer not set. Call setViewContainer() first.');
    }

    // Check if component exists in registry
    const components = this.unifiedRegistry.getAllComponents();
    const component = components.find((comp) => comp.id === componentId);
    if (!component) {
      throw new Error(`Component ${componentId} not found in unified registry`);
    }

    console.log('[ComponentInjectionService] renderComponentInto using CDK Portal:', componentId);

    // Create a portal for the component
    const componentPortal = new ComponentPortal(
      component.component,
      null, // viewContainerRef - null for detached component
      this.injector
    );

    // Create a portal outlet attached to the target DOM element
    const portalOutlet = new DomPortalOutlet(
      element,
      this.appRef.components[0]?.componentFactoryResolver || this.appRef.injector.get(ComponentFactoryResolver),
      this.appRef,
      this.injector
    );

    // Attach the portal to render the component
    const componentRef = portalOutlet.attach(componentPortal);

    // Set data on the component instance
    Object.keys(data).forEach(key => {
      if (key in (componentRef.instance as any)) {
        (componentRef.instance as any)[key] = data[key];
      }
    });

    // Trigger change detection
    componentRef.changeDetectorRef.detectChanges();

    // Create instance record
    const instance: InjectedComponentInstance = {
      instanceId,
      componentDef: component,
      componentRef,
      data,
      position: undefined,
      portalOutlet // Store the outlet for cleanup
    };

    // Track the instance
    this.dispatch({ type: 'ADD_INSTANCE', instance });

    console.log('[ComponentInjectionService] Component rendered via CDK Portal');

    return instance;
  }
}
