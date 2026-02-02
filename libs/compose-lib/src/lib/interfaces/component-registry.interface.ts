/**
 * Component Registry Interface
 * 
 * Defines the API for component type registration and management.
 * Pure registration logic - no rendering or state management.
 * 
 * @module ComponentRegistry
 */

import { Observable } from 'rxjs';
import { ComponentMetadata, ComponentRegistryEntry, MetadataValidationResult } from './component-metadata.interface';

/**
 * Component Registry API
 * Service interface for managing component type registration
 */
export interface ComponentRegistryAPI {
  /**
   * Register a new component type
   * 
   * @param metadata - Component metadata
   * @param source - Source identifier (e.g., 'blogging-ui', 'manual')
   * @throws Error if component ID already registered
   * @returns The registered entry
   */
  register(metadata: ComponentMetadata, source?: string): ComponentRegistryEntry;

  /**
   * Unregister a component type
   * 
   * @param componentId - ID of component to unregister
   * @param source - Optional source filter (only unregister if from this source)
   * @returns True if unregistered, false if not found
   */
  unregister(componentId: string, source?: string): boolean;

  /**
   * Check if a component is registered
   * 
   * @param componentId - Component ID to check
   * @returns True if registered
   */
  isRegistered(componentId: string): boolean;

  /**
   * Get component metadata by ID
   * 
   * @param componentId - Component ID
   * @returns Component metadata or undefined if not found
   */
  get(componentId: string): ComponentMetadata | undefined;

  /**
   * Get component registry entry by ID
   * Includes additional metadata like registration time and usage count
   * 
   * @param componentId - Component ID
   * @returns Registry entry or undefined if not found
   */
  getEntry(componentId: string): ComponentRegistryEntry | undefined;

  /**
   * Get all registered components
   * 
   * @returns Array of all registered component metadata
   */
  getAll(): readonly ComponentMetadata[];

  /**
   * Get all registry entries
   * 
   * @returns Array of all registry entries
   */
  getAllEntries(): readonly ComponentRegistryEntry[];

  /**
   * Get components by category
   * 
   * @param category - Category to filter by
   * @returns Array of components in this category
   */
  getByCategory(category: string): readonly ComponentMetadata[];

  /**
   * Get components by source
   * 
   * @param source - Source to filter by
   * @returns Array of components from this source
   */
  getBySource(source: string): readonly ComponentMetadata[];

  /**
   * Get components by tags
   * 
   * @param tags - Tags to filter by (matches any)
   * @returns Array of components with any of these tags
   */
  getByTags(tags: readonly string[]): readonly ComponentMetadata[];

  /**
   * Search components
   * 
   * @param query - Search query string
   * @returns Array of components matching query (searches name, description, tags)
   */
  search(query: string): readonly ComponentMetadata[];

  /**
   * Get all categories
   * 
   * @returns Array of unique category names
   */
  getCategories(): readonly string[];

  /**
   * Validate component metadata
   * 
   * @param metadata - Metadata to validate
   * @returns Validation result
   */
  validate(metadata: ComponentMetadata): MetadataValidationResult;

  /**
   * Increment usage count for a component
   * 
   * @param componentId - Component ID
   */
  incrementUsage(componentId: string): void;

  /**
   * Get component count
   * 
   * @returns Total number of registered components
   */
  getCount(): number;

  /**
   * Clear all registered components
   * 
   * @param source - Optional source filter (only clear components from this source)
   */
  clear(source?: string): void;

  /**
   * Observable of registry changes
   * Emits when components are registered/unregistered
   */
  readonly changes$: Observable<ComponentRegistryChange>;
}

/**
 * Component registry change event
 */
export interface ComponentRegistryChange {
  /** Type of change */
  readonly type: 'registered' | 'unregistered' | 'updated' | 'cleared';

  /** Component ID (undefined for clear) */
  readonly componentId?: string;

  /** Component metadata (for registered/updated) */
  readonly metadata?: ComponentMetadata;

  /** Source identifier */
  readonly source?: string;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Component registry statistics
 */
export interface ComponentRegistryStats {
  /** Total component count */
  readonly total: number;

  /** Count by category */
  readonly byCategory: Readonly<Record<string, number>>;

  /** Count by source */
  readonly bySource: Readonly<Record<string, number>>;

  /** Most used components */
  readonly mostUsed: readonly ComponentRegistryEntry[];

  /** Recently registered */
  readonly recentlyRegistered: readonly ComponentRegistryEntry[];
}
