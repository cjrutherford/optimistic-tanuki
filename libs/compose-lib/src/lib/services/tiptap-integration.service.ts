import { Injectable, ComponentRef, ViewContainerRef, signal } from '@angular/core';
import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';

/**
 * TipTap Integration Service for managing component integration with TipTap editor
 */
@Injectable({
    providedIn: 'root',
})
export class TipTapIntegrationService {
    private nodeComponentMap = new Map<string, InjectedComponentInstance>();
    private componentNodeMap = new Map<string, any>(); // TipTap node references

    // Signals for reactive updates
    private _activeNodes = signal<Map<string, any>>(new Map());
    public activeNodes = this._activeNodes.asReadonly();

    /**
     * Register a TipTap node with a component instance
     */
    registerNodeComponent(nodeId: string, instance: InjectedComponentInstance, tipTapNode?: any): void {
        console.log('[TipTapIntegrationService] Registering node-component mapping:', { nodeId, instanceId: instance.instanceId });

        this.nodeComponentMap.set(nodeId, instance);

        if (tipTapNode) {
            this.componentNodeMap.set(instance.instanceId, tipTapNode);
            const currentNodes = new Map(this._activeNodes());
            currentNodes.set(nodeId, tipTapNode);
            this._activeNodes.set(currentNodes);
        }
    }

    /**
     * Unregister a node-component mapping
     */
    unregisterNodeComponent(nodeId: string): InjectedComponentInstance | undefined {
        console.log('[TipTapIntegrationService] Unregistering node-component mapping:', nodeId);

        const instance = this.nodeComponentMap.get(nodeId);
        if (instance) {
            this.nodeComponentMap.delete(nodeId);
            this.componentNodeMap.delete(instance.instanceId);

            const currentNodes = new Map(this._activeNodes());
            currentNodes.delete(nodeId);
            this._activeNodes.set(currentNodes);
        }

        return instance;
    }

    /**
     * Get component instance by TipTap node ID
     */
    getComponentByNodeId(nodeId: string): InjectedComponentInstance | undefined {
        return this.nodeComponentMap.get(nodeId);
    }

    /**
     * Get TipTap node by component instance ID
     */
    getNodeByInstanceId(instanceId: string): any {
        return this.componentNodeMap.get(instanceId);
    }

    /**
     * Update TipTap node attributes/data
     */
    updateNodeData(nodeId: string, data: Record<string, any>): void {
        console.log('[TipTapIntegrationService] Updating node data:', { nodeId, data });

        const node = this._activeNodes().get(nodeId);
        if (node && typeof node.updateAttributes === 'function') {
            node.updateAttributes(data);
        }
    }

    /**
     * Remove TipTap node from editor
     */
    removeNode(nodeId: string): void {
        console.log('[TipTapIntegrationService] Removing node:', nodeId);

        const node = this._activeNodes().get(nodeId);
        if (node && typeof node.deleteSelection === 'function') {
            node.deleteSelection();
        }

        this.unregisterNodeComponent(nodeId);
    }

    /**
     * Create TipTap node renderer for Angular components
     */
    createComponentRenderer(
        viewContainer: ViewContainerRef,
        onComponentCreated?: (instance: InjectedComponentInstance, element: HTMLElement) => void
    ) {
        return (componentId: string, instanceId: string, data: any, container: HTMLElement): InjectedComponentInstance | undefined => {
            console.log('[TipTapIntegrationService] Rendering component in TipTap:', { componentId, instanceId });

            try {
                // This would typically get the component definition from the main service
                const instance: InjectedComponentInstance = {
                    instanceId,
                    componentDef: {
                        id: componentId,
                        name: `Component ${componentId}`,
                        component: {} as any, // Would be resolved from registry
                    },
                    data: data || {},
                };

                // Set up the DOM element with component content
                container.setAttribute('data-instance-id', instanceId);
                container.setAttribute('data-component-id', componentId);
                container.classList.add('tiptap-component-wrapper');

                // Call the creation callback if provided
                onComponentCreated?.(instance, container);

                return instance;
            } catch (error) {
                console.error('[TipTapIntegrationService] Error rendering component:', error);
                return undefined;
            }
        };
    }

    /**
     * Create update callback for TipTap component updates
     */
    createUpdateCallback(
        onComponentUpdated?: (instanceId: string, data: Record<string, any>) => void
    ) {
        return (instanceId: string, data: Record<string, any>): void => {
            console.log('[TipTapIntegrationService] Updating component data:', { instanceId, data });

            // Find the DOM element and update it
            const element = document.querySelector(`[data-instance-id="${instanceId}"]`);
            if (element) {
                // Update data attributes
                Object.keys(data).forEach(key => {
                    element.setAttribute(`data-${key}`, JSON.stringify(data[key]));
                });
            }

            // Call the update callback if provided
            onComponentUpdated?.(instanceId, data);
        };
    }

    /**
     * Create remove callback for TipTap component removal
     */
    createRemoveCallback(
        onComponentRemoved?: (instanceId: string) => void
    ) {
        return (instanceId: string): void => {
            console.log('[TipTapIntegrationService] Removing component:', instanceId);

            // Find and remove the DOM element
            const element = document.querySelector(`[data-instance-id="${instanceId}"]`);
            if (element) {
                element.remove();
            }

            // Clean up any node mappings
            const nodeId = Array.from(this.nodeComponentMap.entries())
                .find(([_, instance]) => instance.instanceId === instanceId)?.[0];

            if (nodeId) {
                this.unregisterNodeComponent(nodeId);
            }

            // Call the remove callback if provided
            onComponentRemoved?.(instanceId);
        };
    }

    /**
     * Get all active TipTap nodes
     */
    getAllNodes(): Map<string, any> {
        return new Map(this._activeNodes());
    }

    /**
     * Clear all node-component mappings
     */
    clearAll(): void {
        console.log('[TipTapIntegrationService] Clearing all mappings');
        this.nodeComponentMap.clear();
        this.componentNodeMap.clear();
        this._activeNodes.set(new Map());
    }
}