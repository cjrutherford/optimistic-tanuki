import { Injectable, Type, signal, computed } from '@angular/core';
import { InjectableComponent } from '../interfaces/component-injection.interface';

/**
 * Interface for component registration with metadata
 */
export interface ComponentRegistration {
    component: InjectableComponent;
    source: string; // e.g., 'blogging-ui', 'social-ui', 'compose-lib'
    version?: string;
    tags?: string[];
}

/**
 * Unified Component Registry Service
 * Central registry for all components across all libraries
 */
@Injectable({
    providedIn: 'root',
})
export class UnifiedComponentRegistryService {
    // Internal component storage
    private _components = signal<Map<string, ComponentRegistration>>(new Map());
    private _categories = signal<Map<string, InjectableComponent[]>>(new Map());
    private _sources = signal<Map<string, InjectableComponent[]>>(new Map());

    // Public reactive signals
    public components = computed(() => Array.from(this._components().values()).map(reg => reg.component));
    public componentsByCategory = computed(() => new Map(this._categories()));
    public componentsBySource = computed(() => new Map(this._sources()));
    public categories = computed(() => Array.from(this._categories().keys()));
    public sources = computed(() => Array.from(this._sources().keys()));

    /**
     * Register a component in the unified registry
     */
    registerComponent(
        component: InjectableComponent,
        source: string,
        options?: { version?: string; tags?: string[] }
    ): void {
        console.log(`[UnifiedComponentRegistry] Registering component ${component.id} from ${source}`);

        const registration: ComponentRegistration = {
            component,
            source,
            version: options?.version,
            tags: options?.tags,
        };

        // Update components map
        const components = new Map(this._components());
        components.set(component.id, registration);
        this._components.set(components);

        // Update categories map
        this.updateCategoriesMap(component);

        // Update sources map
        this.updateSourcesMap(component, source);

        console.log(`[UnifiedComponentRegistry] Component ${component.id} registered successfully`);
    }

    /**
     * Register multiple components from a source
     */
    registerComponents(
        components: InjectableComponent[],
        source: string,
        options?: { version?: string; tags?: string[] }
    ): void {
        console.log(`[UnifiedComponentRegistry] Batch registering ${components.length} components from ${source}`);

        components.forEach(component => {
            this.registerComponent(component, source, options);
        });

        console.log(`[UnifiedComponentRegistry] Batch registration complete for ${source}`);
    }

    /**
     * Unregister a component (optionally from a specific source)
     */
    unregisterComponent(componentId: string, source?: string): boolean {
        const components = new Map(this._components());
        const registration = components.get(componentId);

        if (!registration) {
            console.warn(`[UnifiedComponentRegistry] Component ${componentId} not found for unregistration`);
            return false;
        }

        // If source is specified, only unregister if it matches
        if (source && registration.source !== source) {
            console.warn(`[UnifiedComponentRegistry] Component ${componentId} source mismatch: expected ${source}, found ${registration.source}`);
            return false;
        }

        components.delete(componentId);
        this._components.set(components);

        // Rebuild categories and sources maps
        this.rebuildCategoriesMap();
        this.rebuildSourcesMap();

        console.log(`[UnifiedComponentRegistry] Component ${componentId} unregistered`);
        return true;
    }

    /**
     * Unregister all components from a source
     */
    unregisterSource(source: string): number {
        console.log(`[UnifiedComponentRegistry] Unregistering all components from ${source}`);

        const components = new Map(this._components());
        let removedCount = 0;

        for (const [id, registration] of components.entries()) {
            if (registration.source === source) {
                components.delete(id);
                removedCount++;
            }
        }

        this._components.set(components);

        // Rebuild maps
        this.rebuildCategoriesMap();
        this.rebuildSourcesMap();

        console.log(`[UnifiedComponentRegistry] Removed ${removedCount} components from ${source}`);
        return removedCount;
    }

    /**
     * Get component by ID
     */
    getComponent(componentId: string): InjectableComponent | undefined {
        return this._components().get(componentId)?.component;
    }

    /**
     * Get component registration info
     */
    getComponentRegistration(componentId: string): ComponentRegistration | undefined {
        return this._components().get(componentId);
    }

    /**
     * Get components by category
     */
    getComponentsByCategory(category: string): InjectableComponent[] {
        return this._categories().get(category) || [];
    }

    /**
     * Get all components
     */
    getAllComponents(): InjectableComponent[] {
        return Array.from(this._components().values()).map(reg => reg.component);
    }

    /**
     * Get components by source
     */
    getComponentsBySource(source: string): InjectableComponent[] {
        return this._sources().get(source) || [];
    }

    /**
     * Search components by criteria
     */
    searchComponents(criteria: {
        name?: string;
        category?: string;
        source?: string;
        tags?: string[];
    }): InjectableComponent[] {
        const allComponents = Array.from(this._components().values());

        return allComponents
            .filter(registration => {
                const component = registration.component;

                // Filter by name (partial match, case insensitive)
                if (criteria.name && !component.name.toLowerCase().includes(criteria.name.toLowerCase())) {
                    return false;
                }

                // Filter by category
                if (criteria.category && component.category !== criteria.category) {
                    return false;
                }

                // Filter by source
                if (criteria.source && registration.source !== criteria.source) {
                    return false;
                }

                // Filter by tags
                if (criteria.tags && criteria.tags.length > 0) {
                    const componentTags = registration.tags || [];
                    if (!criteria.tags.some(tag => componentTags.includes(tag))) {
                        return false;
                    }
                }

                return true;
            })
            .map(registration => registration.component);
    }

    /**
     * Get component statistics
     */
    getStats(): {
        totalComponents: number;
        categoriesCount: number;
        sourcesCount: number;
        componentsBySource: Record<string, number>;
        componentsByCategory: Record<string, number>;
    } {
        const components = this._components();
        const sources = new Map<string, number>();
        const categories = new Map<string, number>();

        for (const registration of components.values()) {
            // Count by source
            sources.set(registration.source, (sources.get(registration.source) || 0) + 1);

            // Count by category
            const category = registration.component.category || 'uncategorized';
            categories.set(category, (categories.get(category) || 0) + 1);
        }

        return {
            totalComponents: components.size,
            categoriesCount: this._categories().size,
            sourcesCount: this._sources().size,
            componentsBySource: Object.fromEntries(sources),
            componentsByCategory: Object.fromEntries(categories),
        };
    }

    /**
     * Clear all components
     */
    clearAll(): void {
        console.log('[UnifiedComponentRegistry] Clearing all components');
        this._components.set(new Map());
        this._categories.set(new Map());
        this._sources.set(new Map());
    }

    /**
     * Export component registry for debugging
     */
    exportRegistry(): ComponentRegistration[] {
        return Array.from(this._components().values());
    }

    // Private helper methods

    private updateCategoriesMap(component: InjectableComponent): void {
        const categories = new Map(this._categories());
        const category = component.category || 'uncategorized';

        if (!categories.has(category)) {
            categories.set(category, []);
        }

        const categoryComponents = categories.get(category)!;
        // Remove if exists, then add (to handle updates)
        const filteredComponents = categoryComponents.filter(c => c.id !== component.id);
        filteredComponents.push(component);
        categories.set(category, filteredComponents);

        this._categories.set(categories);
    }

    private updateSourcesMap(component: InjectableComponent, source: string): void {
        const sources = new Map(this._sources());

        if (!sources.has(source)) {
            sources.set(source, []);
        }

        const sourceComponents = sources.get(source)!;
        // Remove if exists, then add (to handle updates)
        const filteredComponents = sourceComponents.filter(c => c.id !== component.id);
        filteredComponents.push(component);
        sources.set(source, filteredComponents);

        this._sources.set(sources);
    }

    private rebuildCategoriesMap(): void {
        const categories = new Map<string, InjectableComponent[]>();

        for (const registration of this._components().values()) {
            const component = registration.component;
            const category = component.category || 'uncategorized';

            if (!categories.has(category)) {
                categories.set(category, []);
            }

            categories.get(category)!.push(component);
        }

        this._categories.set(categories);
    }

    private rebuildSourcesMap(): void {
        const sources = new Map<string, InjectableComponent[]>();

        for (const registration of this._components().values()) {
            const component = registration.component;
            const source = registration.source;

            if (!sources.has(source)) {
                sources.set(source, []);
            }

            sources.get(source)!.push(component);
        }

        this._sources.set(sources);
    }
}