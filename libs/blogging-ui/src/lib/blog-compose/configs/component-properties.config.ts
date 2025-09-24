import { PropertyDefinition } from '../components/property-editor.component';

export const COMPONENT_PROPERTY_DEFINITIONS: { [componentId: string]: PropertyDefinition[] } = {
  'callout-box': [
    {
      key: 'type',
      type: 'string',
      label: 'Callout Type',
      description: 'Type of callout box (info, warning, success, error)',
      defaultValue: 'info'
    },
    {
      key: 'title',
      type: 'string',
      label: 'Title',
      description: 'Optional title for the callout box',
      defaultValue: ''
    },
    {
      key: 'content',
      type: 'string',
      label: 'Content',
      description: 'Main content of the callout box',
      defaultValue: 'This is a callout box component.'
    }
  ],
  
  'code-snippet': [
    {
      key: 'title',
      type: 'string',
      label: 'Title',
      description: 'Optional title for the code snippet',
      defaultValue: ''
    },
    {
      key: 'language',
      type: 'string',
      label: 'Programming Language',
      description: 'Language for syntax highlighting',
      defaultValue: 'javascript'
    },
    {
      key: 'code',
      type: 'string',
      label: 'Code Content',
      description: 'The actual code to display',
      defaultValue: 'console.log("Hello, World!");'
    }
  ],
  
  'image-gallery': [
    {
      key: 'title',
      type: 'string',
      label: 'Gallery Title',
      description: 'Optional title for the image gallery',
      defaultValue: ''
    },
    {
      key: 'columns',
      type: 'number',
      label: 'Number of Columns',
      description: 'How many columns to display (1-4)',
      defaultValue: 3
    },
    {
      key: 'images',
      type: 'array',
      label: 'Images',
      description: 'Array of image objects with url, alt, and caption properties',
      defaultValue: [
        { url: 'https://picsum.photos/300/200?random=1', alt: 'Sample image 1', caption: 'Sample caption 1' },
        { url: 'https://picsum.photos/300/200?random=2', alt: 'Sample image 2', caption: 'Sample caption 2' },
        { url: 'https://picsum.photos/300/200?random=3', alt: 'Sample image 3', caption: 'Sample caption 3' }
      ]
    }
  ],
  
  'hero': [
    {
      key: 'title',
      type: 'string',
      label: 'Hero Title',
      description: 'Main title text for the hero section',
      defaultValue: 'Welcome to Our Blog!'
    },
    {
      key: 'subtitle',
      type: 'string',
      label: 'Subtitle',
      description: 'Optional subtitle text',
      defaultValue: ''
    },
    {
      key: 'description',
      type: 'string',
      label: 'Description',
      description: 'Descriptive text below the title',
      defaultValue: 'Discover the latest news, tips, and stories from our community.'
    },
    {
      key: 'buttonText',
      type: 'string',
      label: 'Button Text',
      description: 'Text for the call-to-action button',
      defaultValue: 'Get Started'
    },
    {
      key: 'imageUrl',
      type: 'url',
      label: 'Background Image URL',
      description: 'URL for the hero background image',
      defaultValue: 'https://via.placeholder.com/600x400'
    }
  ],
  
  'featured-posts': [
    {
      key: 'visibleItems',
      type: 'number',
      label: 'Visible Posts',
      description: 'Number of posts to show at once',
      defaultValue: 3
    },
    {
      key: 'featuredPosts',
      type: 'array',
      label: 'Featured Posts',
      description: 'Array of post objects with title, bannerImage, excerpt, authorName, publishDate, and readMoreLink',
      defaultValue: [
        {
          title: 'Understanding Microservices Architecture',
          bannerImage: 'https://picsum.photos/id/1011/800/400',
          excerpt: 'A deep dive into the principles and benefits of microservices.',
          authorName: 'Jane Doe',
          publishDate: '2024-05-10',
          readMoreLink: '/blog/microservices-architecture'
        }
      ]
    }
  ],
  
  'newsletter-signup': [
    {
      key: 'bannerImage',
      type: 'url',
      label: 'Banner Image URL',
      description: 'URL for the newsletter signup banner image',
      defaultValue: 'https://picsum.photos/1200/300'
    },
    {
      key: 'signUp',
      type: 'string',
      label: 'Sign Up Event',
      description: 'Event emitted when user signs up for newsletter',
      isOutput: true,
      outputSchema: {
        email: 'string'
      }
    }
  ]
};