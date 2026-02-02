/**
 * Property Type System for Dynamic Components
 * 
 * Provides a comprehensive, type-safe system for defining component properties
 * with validation, default values, and UI rendering hints.
 * 
 * @module PropertyTypes
 */

/**
 * Supported property types for component configuration
 * 
 * Each type corresponds to a specific input control in the property editor
 */
export type PropertyType =
  | 'text'           // Single-line text input
  | 'textarea'       // Multi-line text input
  | 'number'         // Numeric input with optional min/max
  | 'boolean'        // Checkbox or toggle
  | 'select'         // Dropdown selection from options
  | 'radio'          // Radio button group
  | 'color'          // Color picker
  | 'image'          // Image URL or file upload
  | 'date'           // Date picker
  | 'datetime'       // Date and time picker
  | 'array'          // Array of values (repeatable field)
  | 'object'         // Nested object structure
  | 'json';          // Raw JSON editor

/**
 * Option for select/radio properties
 */
export interface PropertyOption<T = unknown> {
  /** Display label */
  readonly label: string;
  
  /** Internal value */
  readonly value: T;
  
  /** Optional description/help text */
  readonly description?: string;
  
  /** Optional icon identifier */
  readonly icon?: string;
  
  /** Whether this option is disabled */
  readonly disabled?: boolean;
}

/**
 * Validation rule for a property
 */
export interface PropertyValidationRule {
  /** Validation function that returns true if valid, or error message if invalid */
  validate: (value: unknown) => boolean | string;
  
  /** Description of what this rule checks */
  description: string;
}

/**
 * Base property definition
 * Contains common fields for all property types
 */
export interface BasePropertyDefinition {
  /** Display label for the property */
  readonly label: string;
  
  /** Type of the property (determines editor UI) */
  readonly type: PropertyType;
  
  /** Default value if not provided */
  readonly defaultValue?: unknown;
  
  /** Whether this property is required */
  readonly required?: boolean;
  
  /** Help text to display */
  readonly description?: string;
  
  /** Placeholder text for input fields */
  readonly placeholder?: string;
  
  /** Validation rules */
  readonly validationRules?: readonly PropertyValidationRule[];
  
  /** Custom validation function */
  readonly validate?: (value: unknown) => boolean | string;
  
  /** Whether this property should be visible in the editor */
  readonly hidden?: boolean;
  
  /** Group/section this property belongs to */
  readonly group?: string;
  
  /** Display order within the group */
  readonly order?: number;
}

/**
 * Text property definition
 */
export interface TextPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'text';
  readonly defaultValue?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly pattern?: RegExp;
}

/**
 * Textarea property definition
 */
export interface TextAreaPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'textarea';
  readonly defaultValue?: string;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly rows?: number;
}

/**
 * Number property definition
 */
export interface NumberPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'number';
  readonly defaultValue?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
}

/**
 * Boolean property definition
 */
export interface BooleanPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'boolean';
  readonly defaultValue?: boolean;
}

/**
 * Select property definition
 */
export interface SelectPropertyDefinition<T = unknown> extends BasePropertyDefinition {
  readonly type: 'select';
  readonly defaultValue?: T;
  readonly options: readonly PropertyOption<T>[];
  readonly multiple?: boolean;
}

/**
 * Radio property definition
 */
export interface RadioPropertyDefinition<T = unknown> extends BasePropertyDefinition {
  readonly type: 'radio';
  readonly defaultValue?: T;
  readonly options: readonly PropertyOption<T>[];
  readonly layout?: 'horizontal' | 'vertical';
}

/**
 * Color property definition
 */
export interface ColorPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'color';
  readonly defaultValue?: string;
  readonly format?: 'hex' | 'rgb' | 'rgba' | 'hsl';
}

/**
 * Image property definition
 */
export interface ImagePropertyDefinition extends BasePropertyDefinition {
  readonly type: 'image';
  readonly defaultValue?: string;
  readonly maxSize?: number;
  readonly acceptedFormats?: readonly string[];
}

/**
 * Date property definition
 */
export interface DatePropertyDefinition extends BasePropertyDefinition {
  readonly type: 'date';
  readonly defaultValue?: Date | string;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
}

/**
 * DateTime property definition
 */
export interface DateTimePropertyDefinition extends BasePropertyDefinition {
  readonly type: 'datetime';
  readonly defaultValue?: Date | string;
  readonly minDate?: Date | string;
  readonly maxDate?: Date | string;
}

/**
 * Array property definition
 */
export interface ArrayPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'array';
  readonly defaultValue?: readonly unknown[];
  readonly itemType?: PropertyType;
  readonly minItems?: number;
  readonly maxItems?: number;
}

/**
 * Object property definition
 */
export interface ObjectPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'object';
  readonly defaultValue?: Record<string, unknown>;
  readonly properties?: PropertySchema;
}

/**
 * JSON property definition
 */
export interface JsonPropertyDefinition extends BasePropertyDefinition {
  readonly type: 'json';
  readonly defaultValue?: unknown;
}

/**
 * Union type of all specific property definitions
 */
export type PropertyDefinition =
  | TextPropertyDefinition
  | TextAreaPropertyDefinition
  | NumberPropertyDefinition
  | BooleanPropertyDefinition
  | SelectPropertyDefinition
  | RadioPropertyDefinition
  | ColorPropertyDefinition
  | ImagePropertyDefinition
  | DatePropertyDefinition
  | DateTimePropertyDefinition
  | ArrayPropertyDefinition
  | ObjectPropertyDefinition
  | JsonPropertyDefinition;

/**
 * Component property schema
 * Maps property names to their definitions
 */
export type PropertySchema = Readonly<Record<string, PropertyDefinition>>;

/**
 * Component data - runtime property values
 * This is what gets passed to the actual Angular component as inputs
 */
export type ComponentData = Record<string, unknown>;

/**
 * Property validation result
 */
export interface PropertyValidationResult {
  /** Whether the property is valid */
  readonly valid: boolean;
  
  /** Validation errors by property key */
  readonly errors: Readonly<Record<string, string>>;
  
  /** Validated and sanitized data */
  readonly data: ComponentData;
}

/**
 * Helper type to extract the value type from a property definition
 */
export type PropertyValue<T extends PropertyDefinition> =
  T extends TextPropertyDefinition ? string :
  T extends TextAreaPropertyDefinition ? string :
  T extends NumberPropertyDefinition ? number :
  T extends BooleanPropertyDefinition ? boolean :
  T extends SelectPropertyDefinition<infer U> ? U :
  T extends RadioPropertyDefinition<infer U> ? U :
  T extends ColorPropertyDefinition ? string :
  T extends ImagePropertyDefinition ? string :
  T extends DatePropertyDefinition ? Date | string :
  T extends DateTimePropertyDefinition ? Date | string :
  T extends ArrayPropertyDefinition ? readonly unknown[] :
  T extends ObjectPropertyDefinition ? Record<string, unknown> :
  T extends JsonPropertyDefinition ? unknown :
  unknown;
