/**
 * Component Registry Service
 * 
 * Manages component type registration, lookup, and validation.
 * Pure registration logic with no rendering or state management.
 * 
 * @example
 * ```typescript
 * // Register a component
 * registry.register({
 *   id: 'callout-box',
 *   name: 'Callout Box',
 *   component: CalloutBoxComponent,
 *   category: 'blogging',
 *   properties: { ... }
 * }, 'blogging-ui');
 * 
 * // Get component by ID
 * const metadata = registry.get('callout-box');
 * 
 * // Get by category
 * const bloggingComponents = registry.getByCategory('blogging');
 * 
 * // Search
 * const results = registry.search('callout');
 * ```
 */

import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import {
  ComponentMetadata,
  ComponentRegistryEntry,
  MetadataValidationResult
} from '../../interfaces/component-metadata.interface';
import {
  ComponentRegistryAPI,
  ComponentRegistryChange,
  ComponentRegistryStats
} from '../../interfaces/component-registry.interface';
import { ComponentEventBusService } from './component-event-bus.service';

/**
 * Component Registry Service
 * 
 * Central registry for all component types that can be dynamically injected.
 * Provides efficient lookup, search, and validation.
 */
@Injectable({
  providedIn: 'root'
})
export class ComponentRegistryService implements ComponentRegistryAPI {
  /**
   * Component storage (by ID)
   * @private
   */
  private readonly components = new Map<string, ComponentRegistryEntry>();

  /**
   * Category index for fast category lookup
   * @private
   */
  private readonly categoryIndex = new Map<string, Set<string>>();

  /**
   * Source index for fast source lookup
   * @private
   */
  private readonly sourceIndex = new Map<string, Set<string>>();

  /**
   * Tag index for fast tag search
   * @private
   */
  private readonly tagIndex = new Map<string, Set<string>>();

  /**
   * Changes subject
   * @private
   */
  private readonly changesSubject = new Subject<ComponentRegistryChange>();

  /**
   * Observable of registry changes
   */
  readonly changes$: Observable<ComponentRegistryChange> = this.changesSubject.asObservable();

  constructor(private readonly eventBus: ComponentEventBusService) {}

  /**
   * Register a new component type
   * 
   * @param metadata - Component metadata
   * @param source - Source identifier (e.g., 'blogging-ui', 'manual')
   * @throws Error if component ID already registered
   * @returns The registered entry
   */
  register(metadata: ComponentMetadata, source = 'manual'): ComponentRegistryEntry {
    // Validate metadata
    const validation = this.validate(metadata);
    if (!validation.valid) {
      throw new Error(`Invalid component metadata: ${validation.errors.join(', ')}`);
    }

    // Check if already registered
    if (this.components.has(metadata.id)) {
      throw new Error(`Component '${metadata.id}' is already registered`);
    }

    // Create registry entry
    const entry: ComponentRegistryEntry = {
      ...metadata,
      registeredAt: Date.now(),
      registeredBy: source,
      usageCount: 0
    };

    // Store component
    this.components.set(metadata.id, entry);

    // Update indices
    this.updateIndices(entry, 'add');

    // Emit change event
    const change: ComponentRegistryChange = {
      type: 'registered',
      componentId: metadata.id,
      metadata,
      source,
      timestamp: Date.now()
    };
    this.changesSubject.next(change);

    // Publish to event bus
    this.eventBus.publish({
      type: 'component:registered',
      componentId: metadata.id,
      category: metadata.category,
      timestamp: Date.now()
    });

    return entry;
  }

  /**
   * Unregister a component type
   * 
   * @param componentId - ID of component to unregister
   * @param source - Optional source filter (only unregister if from this source)
   * @returns True if unregistered, false if not found
   */
  unregister(componentId: string, source?: string): boolean {
    const entry = this.components.get(componentId);
    
    if (!entry) {
      return false;
    }

    // Check source filter
    if (source && entry.registeredBy !== source) {
      return false;
    }

    // Remove from storage
    this.components.delete(componentId);

    // Update indices
    this.updateIndices(entry, 'remove');

    // Emit change event
    const change: ComponentRegistryChange = {
      type: 'unregistered',
      componentId,
      source: entry.registeredBy,
      timestamp: Date.now()
    };
    this.changesSubject.next(change);

    // Publish to event bus
    this.eventBus.publish({
      type: 'component:unregistered',
      componentId,
      timestamp: Date.now()
    });

    return true;
  }

  /**
   * Check if a component is registered
   * 
   * @param componentId - Component ID to check
   * @returns True if registered
   */
  isRegistered(componentId: string): boolean {
    return this.components.has(componentId);
  }

  /**
   * Get component metadata by ID
   * 
   * @param componentId - Component ID
   * @returns Component metadata or undefined if not found
   */
  get(componentId: string): ComponentMetadata | undefined {
    return this.components.get(componentId);
  }

  /**
   * Get component registry entry by ID
   * 
   * @param componentId - Component ID
   * @returns Registry entry or undefined if not found
   */
  getEntry(componentId: string): ComponentRegistryEntry | undefined {
    return this.components.get(componentId);
  }

  /**
   * Get all registered components
   * 
   * @returns Array of all registered component metadata
   */
  getAll(): readonly ComponentMetadata[] {
    return Array.from(this.components.values());
  }

  /**
   * Get all registry entries
   * 
   * @returns Array of all registry entries
   */
  getAllEntries(): readonly ComponentRegistryEntry[] {
    return Array.from(this.components.values());
  }

  /**
   * Get components by category
   * 
   * @param category - Category to filter by
   * @returns Array of components in this category
   */
  getByCategory(category: string): readonly ComponentMetadata[] {
    const componentIds = this.categoryIndex.get(category);
    if (!componentIds) {
      return [];
    }

    return Array.from(componentIds)
      .map(id => this.components.get(id))
      .filter((c): c is ComponentMetadata => c !== undefined);
  }

  /**
   * Get components by source
   * 
   * @param source - Source to filter by
   * @returns Array of components from this source
   */
  getBySource(source: string): readonly ComponentMetadata[] {
    const componentIds = this.sourceIndex.get(source);
    if (!componentIds) {
      return [];
    }

    return Array.from(componentIds)
      .map(id => this.components.get(id))
      .filter((c): c is ComponentMetadata => c !== undefined);
  }

  /**
   * Get components by tags
   * 
   * @param tags - Tags to filter by (matches any)
   * @returns Array of components with any of these tags
   */
  getByTags(tags: readonly string[]): readonly ComponentMetadata[] {
    const matchingIds = new Set<string>();

    for (const tag of tags) {
      const componentIds = this.tagIndex.get(tag.toLowerCase());
      if (componentIds) {
        componentIds.forEach(id => matchingIds.add(id));
      }
    }

    return Array.from(matchingIds)
      .map(id => this.components.get(id))
      .filter((c): c is ComponentMetadata => c !== undefined);
  }

  /**
   * Search components
   * 
   * Searches name, description, and tags
   * 
   * @param query - Search query string
   * @returns Array of components matching query
   */
  search(query: string): readonly ComponentMetadata[] {
    const lowerQuery = query.toLowerCase();
    const results: ComponentMetadata[] = [];

    for (const component of this.components.values()) {
      // Search in name
      if (component.name.toLowerCase().includes(lowerQuery)) {
        results.push(component);
        continue;
      }

      // Search in description
      if (component.description?.toLowerCase().includes(lowerQuery)) {
        results.push(component);
        continue;
      }

      // Search in tags
      if (component.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        results.push(component);
        continue;
      }

      // Search in ID
      if (component.id.toLowerCase().includes(lowerQuery)) {
        results.push(component);
      }
    }

    return results;
  }

  /**
   * Get all categories
   * 
   * @returns Array of unique category names
   */
  getCategories(): readonly string[] {
    return Array.from(this.categoryIndex.keys());
  }

  /**
   * Validate component metadata
   * 
   * @param metadata - Metadata to validate
   * @returns Validation result
   */
  validate(metadata: ComponentMetadata): MetadataValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!metadata.id) {
      errors.push('Component ID is required');
    }
    if (!metadata.name) {
      errors.push('Component name is required');
    }
    if (!metadata.component) {
      errors.push('Component class is required');
    }

    // ID format
    if (metadata.id && !/^[a-z0-9-]+$/.test(metadata.id)) {
      errors.push('Component ID must be lowercase alphanumeric with hyphens');
    }

    // Deprecation check
    if (metadata.deprecated && !metadata.deprecationMessage) {
      warnings.push('Deprecated component should have deprecation message');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Increment usage count for a component
   * 
   * @param componentId - Component ID
   */
  incrementUsage(componentId: string): void {
    const entry = this.components.get(componentId);
    if (entry) {
      entry.usageCount++;
    }
  }

  /**
   * Get component count
   * 
   * @returns Total number of registered components
   */
  getCount(): number {
    return this.components.size;
  }

  /**
   * Clear all registered components
   * 
   * @param source - Optional source filter (only clear components from this source)
   */
  clear(source?: string): void {
    if (source) {
      // Clear only components from specific source
      const componentIds = this.sourceIndex.get(source);
      if (componentIds) {
        for (const id of componentIds) {
          this.unregister(id, source);
        }
      }
    } else {
      // Clear all
      this.components.clear();
      this.categoryIndex.clear();
      this.sourceIndex.clear();
      this.tagIndex.clear();

      // Emit change event
      const change: ComponentRegistryChange = {
        type: 'cleared',
        timestamp: Date.now()
      };
      this.changesSubject.next(change);
    }
  }

  /**
   * Get registry statistics
   * 
   * @returns Statistics object
   */
  getStats(): ComponentRegistryStats {
    const entries = this.getAllEntries();

    // Count by category
    const byCategory: Record<string, number> = {};
    for (const [category, ids] of this.categoryIndex) {
      byCategory[category] = ids.size;
    }

    // Count by source
    const bySource: Record<string, number> = {};
    for (const [source, ids] of this.sourceIndex) {
      bySource[source] = ids.size;
    }

    // Most used (top 10)
    const mostUsed = [...entries]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    // Recently registered (last 10)
    const recentlyRegistered = [...entries]
      .sort((a, b) => b.registeredAt - a.registeredAt)
      .slice(0, 10);

    return {
      total: this.components.size,
      byCategory,
      bySource,
      mostUsed,
      recentlyRegistered
    };
  }

  /**
   * Update indices when component is added/removed
   * @private
   */
  private updateIndices(entry: ComponentRegistryEntry, operation: 'add' | 'remove'): void {
    const { id, category, registeredBy, tags } = entry;

    // Update category index
    if (category) {
      const categorySet = this.categoryIndex.get(category) || new Set();
      if (operation === 'add') {
        categorySet.add(id);
        this.categoryIndex.set(category, categorySet);
      } else {
        categorySet.delete(id);
        if (categorySet.size === 0) {
          this.categoryIndex.delete(category);
        }
      }
    }

    // Update source index
    const sourceSet = this.sourceIndex.get(registeredBy) || new Set();
    if (operation === 'add') {
      sourceSet.add(id);
      this.sourceIndex.set(registeredBy, sourceSet);
    } else {
      sourceSet.delete(id);
      if (sourceSet.size === 0) {
        this.sourceIndex.delete(registeredBy);
      }
    }

    // Update tag index
    if (tags) {
      for (const tag of tags) {
        const tagSet = this.tagIndex.get(tag.toLowerCase()) || new Set();
        if (operation === 'add') {
          tagSet.add(id);
          this.tagIndex.set(tag.toLowerCase(), tagSet);
        } else {
          tagSet.delete(id);
          if (tagSet.size === 0) {
            this.tagIndex.delete(tag.toLowerCase());
          }
        }
      }
    }
  }

  /**
   * Cleanup on service destroy
   */
  ngOnDestroy(): void {
    this.changesSubject.complete();
  }
}
