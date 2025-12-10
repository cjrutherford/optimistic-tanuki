import { PropertyDefinition } from '../components/property-editor.component';

/**
 * Component Property Definitions for Social Components
 *
 * This configuration maps component IDs to their editable properties.
 * Used by the property editor to provide configuration UI for injectable components.
 *
 * Social-focused components only:
 * - callout-box: Highlight important information
 * - code-snippet: Display formatted code
 * - image-gallery: Create responsive image galleries
 */
export const COMPONENT_PROPERTY_DEFINITIONS: {
  [componentId: string]: PropertyDefinition[];
} = {
  // ============================================
  // SOCIAL UI COMPONENTS
  // ============================================

  'callout-box': [
    {
      key: 'type',
      type: 'select',
      label: 'Callout Type',
      description: 'Type of callout box',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Success', value: 'success' },
        { label: 'Error', value: 'error' },
      ],
      defaultValue: 'info',
    },
    {
      key: 'title',
      type: 'string',
      label: 'Title',
      description: 'Optional title for the callout box',
      defaultValue: '',
    },
    {
      key: 'content',
      type: 'string',
      label: 'Content',
      description: 'Main content of the callout box',
      defaultValue: 'This is a callout box component.',
    },
  ],

  'code-snippet': [
    {
      key: 'title',
      type: 'string',
      label: 'Title',
      description: 'Optional title for the code snippet',
      defaultValue: '',
    },
    {
      key: 'language',
      type: 'string',
      label: 'Programming Language',
      description: 'Language for syntax highlighting',
      defaultValue: 'javascript',
    },
    {
      key: 'code',
      type: 'string',
      label: 'Code Content',
      description: 'The actual code to display',
      defaultValue: 'console.log("Hello, World!");',
    },
  ],

  'image-gallery': [
    {
      key: 'title',
      type: 'string',
      label: 'Gallery Title',
      description: 'Optional title for the image gallery',
      defaultValue: '',
    },
    {
      key: 'columns',
      type: 'number',
      label: 'Number of Columns',
      description: 'How many columns to display (1-4)',
      defaultValue: 3,
    },
    {
      key: 'images',
      type: 'array',
      label: 'Images',
      description:
        'Array of image objects with url, alt, and caption properties',
      defaultValue: [
        {
          url: 'https://picsum.photos/300/200?random=1',
          alt: 'Sample image 1',
          caption: 'Sample caption 1',
        },
        {
          url: 'https://picsum.photos/300/200?random=2',
          alt: 'Sample image 2',
          caption: 'Sample caption 2',
        },
        {
          url: 'https://picsum.photos/300/200?random=3',
          alt: 'Sample image 3',
          caption: 'Sample caption 3',
        },
      ],
    },
  ],
};
