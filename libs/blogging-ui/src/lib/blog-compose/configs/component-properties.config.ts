import { PropertyDefinition } from '../components/property-editor.component';

/**
 * Component Property Definitions
 *
 * This configuration maps component IDs to their editable properties.
 * Used by the property editor and component editor wrapper to provide
 * configuration UI for injectable components.
 *
 * Components are organized by library:
 * - Blogging UI: callout-box, code-snippet, image-gallery, hero, featured-posts, newsletter-signup
 * - Common UI: card, button, accordion, modal, hero-section, content-section
 * - Form UI: text-input, checkbox, select, radio-button, text-area
 */
export const COMPONENT_PROPERTY_DEFINITIONS: {
  [componentId: string]: PropertyDefinition[];
} = {
  // ============================================
  // BLOGGING UI COMPONENTS
  // ============================================

  'callout-box': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'type',
      type: 'string',
      label: 'Callout Type',
      description: 'Type of callout box (info, warning, success, error)',
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
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
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
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
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

  hero: [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'title',
      type: 'string',
      label: 'Hero Title',
      description: 'Main title text for the hero section',
      defaultValue: 'Welcome to Our Blog!',
    },
    {
      key: 'subtitle',
      type: 'string',
      label: 'Subtitle',
      description: 'Optional subtitle text',
      defaultValue: '',
    },
    {
      key: 'description',
      type: 'string',
      label: 'Description',
      description: 'Descriptive text below the title',
      defaultValue:
        'Discover the latest news, tips, and stories from our community.',
    },
    {
      key: 'buttonText',
      type: 'string',
      label: 'Button Text',
      description: 'Text for the call-to-action button',
      defaultValue: 'Get Started',
    },
    {
      key: 'imageUrl',
      type: 'url',
      label: 'Background Image URL',
      description: 'URL for the hero background image',
      defaultValue: 'https://via.placeholder.com/600x400',
    },
  ],

  'featured-posts': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'visibleItems',
      type: 'number',
      label: 'Visible Posts',
      description: 'Number of posts to show at once',
      defaultValue: 3,
    },
    {
      key: 'featuredPosts',
      type: 'array',
      label: 'Featured Posts',
      description:
        'Array of post objects with title, bannerImage, excerpt, authorName, publishDate, and readMoreLink',
      defaultValue: [
        {
          title: 'Understanding Microservices Architecture',
          bannerImage: 'https://picsum.photos/id/1011/800/400',
          excerpt:
            'A deep dive into the principles and benefits of microservices.',
          authorName: 'Jane Doe',
          publishDate: '2024-05-10',
          readMoreLink: '/blog/microservices-architecture',
        },
      ],
    },
  ],

  'newsletter-signup': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'bannerImage',
      type: 'string',
      label: 'Banner Image URL',
      description: 'URL for the newsletter signup banner image',
      defaultValue: 'https://via.placeholder.com/600x200',
    },
    {
      key: 'heading',
      type: 'string',
      label: 'Heading',
      description: 'Main heading text for the signup section',
      defaultValue: 'Subscribe to Our Newsletter',
    },
    {
      key: 'subheading',
      type: 'string',
      label: 'Subheading',
      description: 'Optional subheading text',
      defaultValue: 'Get the latest updates delivered to your inbox.',
    },
    {
      key: 'submitEvent',
      type: 'string',
      label: 'Submit Event',
      description: 'Event emitted when the signup form is submitted',
      isOutput: true,
      outputSchema: { email: 'string' },
    },
  ],
  // ============================================
  // COMMON UI COMPONENTS
  // ============================================

  'common-card': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'glassEffect',
      type: 'boolean',
      label: 'Glass Effect',
      description: 'Enable glassmorphism visual effect',
      defaultValue: false,
    },
    {
      key: 'CardVariant',
      type: 'string',
      label: 'Card Variant',
      description:
        'Visual style variant (default, glass, gradient, neon, etc.)',
      defaultValue: 'default',
    },
  ],

  'common-button': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'variant',
      type: 'string',
      label: 'Button Variant',
      description:
        'Visual style: primary, secondary, outlined, text, warning, danger, success, rounded',
      defaultValue: 'primary',
    },
    {
      key: 'disabled',
      type: 'boolean',
      label: 'Disabled',
      description: 'Whether the button is disabled',
      defaultValue: false,
    },
    {
      key: 'label',
      type: 'string',
      label: 'Button Label',
      description: 'Text displayed on the button',
      defaultValue: 'Click Me',
    },
    {
      key: 'action',
      type: 'string',
      label: 'Click Action',
      description: 'Event emitted when button is clicked',
      isOutput: true,
      outputSchema: {},
    },
  ],

  'common-accordion': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'variant',
      type: 'select',
      label: 'Accordion Variant',
      description: 'Visual style: default, glass, gradient',
      defaultValue: 'default',
    },
    {
      key: 'size',
      type: 'string',
      label: 'Size',
      description: 'Accordion size: sm, md, lg',
      defaultValue: 'md',
    },
    {
      key: 'sections',
      type: 'array',
      label: 'Sections',
      description: 'Array of accordion sections with heading and content',
      defaultValue: [
        { heading: 'Section 1', content: 'Content for section 1' },
        { heading: 'Section 2', content: 'Content for section 2' },
      ],
    },
  ],

  'common-modal': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'heading',
      type: 'string',
      label: 'Modal Heading',
      description: 'Title text for the modal',
      defaultValue: 'Modal Title',
    },
    {
      key: 'mode',
      type: 'string',
      label: 'Display Mode',
      description:
        'Modal mode: sidebar, sidebar-left, trough, standard-modal, captive-modal',
      defaultValue: 'standard-modal',
    },
    {
      key: 'variant',
      type: 'string',
      label: 'Visual Variant',
      description: 'Visual style: default, glass, gradient',
      defaultValue: 'default',
    },
    {
      key: 'size',
      type: 'string',
      label: 'Size',
      description: 'Modal size: sm, md, lg',
      defaultValue: 'md',
    },
    {
      key: 'closeModal',
      type: 'string',
      label: 'Close Event',
      description: 'Event emitted when modal is closed',
      isOutput: true,
      outputSchema: {},
    },
  ],

  'common-hero-section': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'title',
      type: 'string',
      label: 'Title',
      description: 'Main title for the hero section',
      defaultValue: 'Welcome',
    },
    {
      key: 'subtitle',
      type: 'string',
      label: 'Subtitle',
      description: 'Secondary text below the title',
      defaultValue: 'Discover amazing content',
    },
    {
      key: 'backgroundImage',
      type: 'url',
      label: 'Background Image',
      description: 'URL for background image',
      defaultValue: '',
    },
    {
      key: 'alignment',
      type: 'string',
      label: 'Text Alignment',
      description: 'Alignment of content: left, center, right',
      defaultValue: 'center',
    },
  ],

  'common-content-section': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'title',
      type: 'string',
      label: 'Section Title',
      description: 'Title for the content section',
      defaultValue: 'Content Section',
    },
    {
      key: 'layout',
      type: 'string',
      label: 'Layout',
      description: 'Content layout: single-column, two-column, grid',
      defaultValue: 'single-column',
    },
  ],

  // ============================================
  // FORM UI COMPONENTS
  // ============================================

  'form-text-input': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'type',
      type: 'string',
      label: 'Input Type',
      description: 'Type of input: text, password, obscured, date',
      defaultValue: 'text',
    },
    {
      key: 'label',
      type: 'string',
      label: 'Label',
      description: 'Label text for the input',
      defaultValue: 'Text Input',
    },
    {
      key: 'placeholder',
      type: 'string',
      label: 'Placeholder',
      description: 'Placeholder text when input is empty',
      defaultValue: 'Enter text...',
    },
    {
      key: 'labelPosition',
      type: 'string',
      label: 'Label Position',
      description: 'Position of label: top, left, right, bottom',
      defaultValue: 'top',
    },
    {
      key: 'valueChange',
      type: 'string',
      label: 'Value Change Event',
      description: 'Event emitted when value changes',
      isOutput: true,
      outputSchema: { value: 'string' },
    },
  ],

  'form-checkbox': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'value',
      type: 'boolean',
      label: 'Checked',
      description: 'Whether the checkbox is checked',
      defaultValue: false,
    },
    {
      key: 'changeEvent',
      type: 'string',
      label: 'Change Event',
      description: 'Event emitted when checkbox state changes',
      isOutput: true,
      outputSchema: { checked: 'boolean' },
    },
  ],

  'form-select': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'options',
      type: 'array',
      label: 'Options',
      description: 'Array of options with value and label properties',
      defaultValue: [
        { value: 'option1', label: 'Option 1' },
        { value: 'option2', label: 'Option 2' },
        { value: 'option3', label: 'Option 3' },
      ],
    },
  ],

  'form-radio-button': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'options',
      type: 'array',
      label: 'Radio Options',
      description: 'Array of options with label and value properties',
      defaultValue: [
        { label: 'Option 1', value: 'option1' },
        { label: 'Option 2', value: 'option2' },
      ],
    },
    {
      key: 'layout',
      type: 'string',
      label: 'Layout',
      description: 'Layout direction: vertical, horizontal, grid',
      defaultValue: 'vertical',
    },
    {
      key: 'selected',
      type: 'string',
      label: 'Selected Value',
      description: 'Currently selected value',
      defaultValue: '',
    },
    {
      key: 'selectedValue',
      type: 'string',
      label: 'Selection Event',
      description: 'Event emitted when selection changes',
      isOutput: true,
      outputSchema: { value: 'string' },
    },
  ],

  'form-text-area': [
    {
      key: 'theme',
      type: 'select',
      label: 'Theme',
      description: 'Theme mode for this component',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
        { label: 'Auto', value: 'auto' },
      ],
      defaultValue: 'auto',
    },
    {
      key: 'label',
      type: 'string',
      label: 'Label',
      description: 'Label text for the text area',
      defaultValue: 'Text Area',
    },
    {
      key: 'valueChange',
      type: 'string',
      label: 'Value Change Event',
      description: 'Event emitted when value changes',
      isOutput: true,
      outputSchema: { value: 'string' },
    },
  ],
};
