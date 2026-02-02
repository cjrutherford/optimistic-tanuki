/**
 * Component Metadata Interface
 * 
 * Defines the structure for registrable component types.
 * This is the blueprint for components that can be injected into editors.
 * 
 * @module ComponentMetadata
 */

import { Type } from '@angular/core';
import { PropertySchema, ComponentData } from '../types/property-types';

/**
 * Component category for organization
 * Components are grouped by category in the component selector
 */
export type ComponentCategory =
  | 'blogging'
  | 'common-ui'
  | 'form-ui'
  | 'layout'
  | 'media'
  | 'custom';

/**
 * Component metadata
 * Complete definition of a component type that can be dynamically injected
 */
export interface ComponentMetadata {
  /**
   * Unique identifier for this component type
   * Must be unique across all registered components
   * @example 'callout-box', 'code-snippet', 'image-gallery'
   */
  readonly id: string;

  /**
   * Human-readable display name
   * Shown in component selector and property editor
   * @example 'Callout Box', 'Code Snippet', 'Image Gallery'
   */
  readonly name: string;

  /**
   * Brief description of what this component does
   * Shown as help text in component selector
   * @example 'Highlight important information with colored callout boxes'
   */
  readonly description?: string;

  /**
   * Angular component class
   * The actual component that will be instantiated
   */
  readonly component: Type<unknown>;

  /**
   * Category for organizing components in the selector
   * @default 'custom'
   */
  readonly category?: ComponentCategory | string;

  /**
   * Icon identifier for UI display
   * Can be Material Icon name or custom icon identifier
   * @example 'info', 'code', 'image'
   */
  readonly icon?: string;

  /**
   * Property schema defining configurable properties
   * Maps property names to their definitions
   */
  readonly properties?: PropertySchema;

  /**
   * Default property values
   * Used when component is first inserted
   */
  readonly defaultData?: ComponentData;

  /**
   * Whether this component supports drag-and-drop rearrangement
   * @default true
   */
  readonly draggable?: boolean;

  /**
   * Whether this component can be deleted by users
   * @default true
   */
  readonly deletable?: boolean;

  /**
   * Whether this component's properties can be edited
   * @default true
   */
  readonly editable?: boolean;

  /**
   * Custom CSS class to apply to the wrapper
   */
  readonly wrapperCssClass?: string;

  /**
   * Minimum required role/permission to use this component
   * @example 'admin', 'editor'
   */
  readonly requiredPermission?: string;

  /**
   * Tags for searching/filtering
   * @example ['content', 'highlight', 'box']
   */
  readonly tags?: readonly string[];

  /**
   * Version of this component definition
   * Used for migration and compatibility
   * @example '1.0.0'
   */
  readonly version?: string;

  /**
   * Author/source of this component
   * @example 'compose-lib', 'blogging-ui', 'custom'
   */
  readonly source?: string;

  /**
   * Preview image URL for component selector
   */
  readonly previewImage?: string;

  /**
   * Whether this component is deprecated
   */
  readonly deprecated?: boolean;

  /**
   * Deprecation message if deprecated
   */
  readonly deprecationMessage?: string;
}

/**
 * Component registry entry
 * Internal representation of a registered component
 */
export interface ComponentRegistryEntry extends ComponentMetadata {
  /**
   * Timestamp when component was registered
   */
  readonly registeredAt: number;

  /**
   * Source that registered this component
   * @example 'blogging-ui', 'social-ui', 'manual'
   */
  readonly registeredBy: string;

  /**
   * Number of times this component has been used
   */
  usageCount: number;
}

/**
 * Component metadata validation result
 */
export interface MetadataValidationResult {
  /**
   * Whether the metadata is valid
   */
  readonly valid: boolean;

  /**
   * Validation errors
   */
  readonly errors: readonly string[];

  /**
   * Validation warnings
   */
  readonly warnings: readonly string[];
}
