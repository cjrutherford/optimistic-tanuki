import { signal, computed, WritableSignal } from '@angular/core';
import {
    InjectableComponent,
    InjectedComponentInstance,
} from '../interfaces/component-injection.interface';

/**
 * Component injection actions for reducer pattern
 */
export type ComponentAction =
    | { type: 'REGISTER_COMPONENT'; component: InjectableComponent }
    | { type: 'UNREGISTER_COMPONENT'; componentId: string }
    | { type: 'ADD_INSTANCE'; instance: InjectedComponentInstance }
    | { type: 'UPDATE_INSTANCE'; instanceId: string; data: Record<string, any> }
    | { type: 'REMOVE_INSTANCE'; instanceId: string }
    | { type: 'MOVE_INSTANCE'; instanceId: string; newPosition: number }
    | { type: 'SELECT_INSTANCE'; instanceId: string | null }
    | { type: 'SET_PROPERTY_EDITOR_VISIBLE'; visible: boolean }
    | { type: 'RESET_STATE' };

/**
 * Component injection state interface
 */
export interface ComponentInjectionState {
    registeredComponents: Map<string, InjectableComponent>;
    activeComponents: Map<string, InjectedComponentInstance>;
    selectedInstanceId: string | null;
    isPropertyEditorVisible: boolean;
    lastActionTimestamp: number;
}

/**
 * Initial state for component injection
 */
export const initialComponentState: ComponentInjectionState = {
    registeredComponents: new Map(),
    activeComponents: new Map(),
    selectedInstanceId: null,
    isPropertyEditorVisible: false,
    lastActionTimestamp: Date.now(),
};

/**
 * Component injection state reducer
 */
export function componentInjectionReducer(
    state: ComponentInjectionState,
    action: ComponentAction
): ComponentInjectionState {
    console.log('[ComponentInjectionReducer] Action:', action.type, action);

    switch (action.type) {
        case 'REGISTER_COMPONENT': {
            const newRegisteredComponents = new Map(state.registeredComponents);
            newRegisteredComponents.set(action.component.id, action.component);

            return {
                ...state,
                registeredComponents: newRegisteredComponents,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'UNREGISTER_COMPONENT': {
            const newRegisteredComponents = new Map(state.registeredComponents);
            newRegisteredComponents.delete(action.componentId);

            return {
                ...state,
                registeredComponents: newRegisteredComponents,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'ADD_INSTANCE': {
            const newActiveComponents = new Map(state.activeComponents);
            newActiveComponents.set(action.instance.instanceId, action.instance);

            return {
                ...state,
                activeComponents: newActiveComponents,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'UPDATE_INSTANCE': {
            const newActiveComponents = new Map(state.activeComponents);
            const existingInstance = newActiveComponents.get(action.instanceId);

            if (existingInstance) {
                const updatedInstance = {
                    ...existingInstance,
                    data: { ...existingInstance.data, ...action.data },
                };
                newActiveComponents.set(action.instanceId, updatedInstance);
            }

            return {
                ...state,
                activeComponents: newActiveComponents,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'REMOVE_INSTANCE': {
            const newActiveComponents = new Map(state.activeComponents);
            newActiveComponents.delete(action.instanceId);

            const newSelectedInstanceId = state.selectedInstanceId === action.instanceId
                ? null
                : state.selectedInstanceId;

            return {
                ...state,
                activeComponents: newActiveComponents,
                selectedInstanceId: newSelectedInstanceId,
                isPropertyEditorVisible: newSelectedInstanceId ? state.isPropertyEditorVisible : false,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'MOVE_INSTANCE': {
            // For now, we'll just update the timestamp since TipTap handles positioning
            // This can be extended to track ordering if needed
            return {
                ...state,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'SELECT_INSTANCE': {
            return {
                ...state,
                selectedInstanceId: action.instanceId,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'SET_PROPERTY_EDITOR_VISIBLE': {
            return {
                ...state,
                isPropertyEditorVisible: action.visible,
                // If hiding editor, clear selection
                selectedInstanceId: action.visible ? state.selectedInstanceId : null,
                lastActionTimestamp: Date.now(),
            };
        }

        case 'RESET_STATE': {
            return {
                ...initialComponentState,
                lastActionTimestamp: Date.now(),
            };
        }

        default:
            return state;
    }
}

/**
 * Component injection state manager using signals and reducer pattern
 */
export class ComponentInjectionStateManager {
    private state: WritableSignal<ComponentInjectionState> = signal(initialComponentState);

    // Computed signals for derived state
    public registeredComponents = computed(() => Array.from(this.state().registeredComponents.values()));
    public activeComponents = computed(() => Array.from(this.state().activeComponents.values()));
    public selectedInstance = computed(() => {
        const instanceId = this.state().selectedInstanceId;
        return instanceId ? this.state().activeComponents.get(instanceId) || null : null;
    });
    public isPropertyEditorVisible = computed(() => this.state().isPropertyEditorVisible);
    public componentsByCategory = computed(() => {
        const components = this.registeredComponents();
        const categories = new Map<string, InjectableComponent[]>();

        components.forEach(component => {
            const category = component.category || 'Other';
            if (!categories.has(category)) {
                categories.set(category, []);
            }
            categories.get(category)!.push(component);
        });

        return categories;
    });

    /**
     * Dispatch an action to update state
     */
    dispatch(action: ComponentAction): void {
        const currentState = this.state();
        const newState = componentInjectionReducer(currentState, action);
        this.state.set(newState);
    }

    /**
     * Get the current state snapshot
     */
    getState(): ComponentInjectionState {
        return this.state();
    }

    /**
     * Get a specific registered component
     */
    getRegisteredComponent(componentId: string): InjectableComponent | undefined {
        return this.state().registeredComponents.get(componentId);
    }

    /**
     * Get a specific active component instance
     */
    getActiveInstance(instanceId: string): InjectedComponentInstance | undefined {
        return this.state().activeComponents.get(instanceId);
    }

    /**
     * Get components by category
     */
    getComponentsByCategory(category: string): InjectableComponent[] {
        return this.registeredComponents().filter(component => component.category === category);
    }

    /**
     * Get component instance by ID
     */
    getComponentInstance(instanceId: string): InjectedComponentInstance | undefined {
        return this.activeComponents().find(instance => instance.instanceId === instanceId);
    }
}