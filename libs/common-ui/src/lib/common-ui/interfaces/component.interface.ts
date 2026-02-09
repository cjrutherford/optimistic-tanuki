/**
 * Base interface for all theme-aware components
 */
export interface ThemeAwareComponent {
  theme: 'light' | 'dark';
  variant: 'default' | 'glass' | 'gradient';
  disabled?: boolean;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
}

/**
 * Components with interactive capabilities
 */
export interface InteractiveComponent extends ThemeAwareComponent {
  hoverable?: boolean;
  keyboard?: boolean;
}

/**
 * Form-associated components
 */
export interface FormComponent extends ThemeAwareComponent {
  required?: boolean;
  error?: boolean;
  errorMessage?: string;
}

/**
 * Components with variant support
 */
export interface VariantComponent {
  variant: 'default' | 'glass' | 'gradient';
  variantOverrides?: any;
}

/**
 * Standard component sizes
 */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Accordion section interface
 */
export interface AccordionSection {
  id?: string;
  heading: string;
  content?: string;
  items?: AccordionItem[];
  subItems?: AccordionSection[];
  disabled?: boolean;
  expanded?: boolean;
}

/**
 * Accordion item interface
 */
export interface AccordionItem {
  id?: string;
  label?: string;
  content?: string;
  disabled?: boolean;
}

/**
 * List item interface
 */
export interface ListItem {
  id?: string | number;
  label?: string;
  content?: string;
  icon?: string;
  disabled?: boolean;
  selected?: boolean;
  /** Accessibility label for the list item */
  ariaLabel?: string;
  /** Accessibility describedby for the list item */
  ariaDescribedBy?: string;
}
