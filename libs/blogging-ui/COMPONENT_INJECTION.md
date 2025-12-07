# Angular Content Projection System for Blog Compose Component

This implementation adds a powerful Angular content projection system to the `blog-compose` component that allows users to inject custom Angular components dynamically into the blog editor.

## Features

### 1. Component Registration System
- Register custom Angular components that can be injected into the editor
- Components are organized by categories:
  - **Blogging**: Callout Box, Code Snippet, Image Gallery, Hero, Featured Posts, Newsletter Signup
  - **Common UI**: Card, Button, Accordion, Modal, Hero Section, Content Section
  - **Form UI**: Text Input, Checkbox, Select, Radio Button, Text Area
- Each component has metadata including name, description, icon, and default data

### 2. Component Injection API
The system provides a comprehensive API for managing component injection:

```typescript
interface ComponentInjectionAPI {
  registerComponent(component: InjectableComponent): void;
  unregisterComponent(componentId: string): void;
  getRegisteredComponents(): InjectableComponent[];
  getComponentsByCategory(category: string): InjectableComponent[];
  injectComponent(componentId: string, data?: any, position?: number): Promise<InjectedComponentInstance>;
  removeComponent(instanceId: string): void;
  updateComponent(instanceId: string, data: any): void;
  getActiveComponents(): InjectedComponentInstance[];
  getComponent(instanceId: string): InjectedComponentInstance | undefined;
  moveComponent(instanceId: string, newPosition: number): void;
}
```

### 3. Component Editor Wrapper
The new `ComponentEditorWrapperComponent` provides:
- **Dynamic Component Rendering**: Renders the actual Angular component inline
- **Inline Editing Controls**: Edit, duplicate, delete, and configure buttons
- **Quick Edit Mode**: Inline property editing without opening a modal
- **Property Preview**: Shows key property values at a glance
- **Selection States**: Visual feedback for hover and selection

### 4. User Interface Integration
- **Component Selector Modal**: Browse and select from available components by category
- **Toolbar Integration**: Easy access button in the TipTap editor toolbar
- **Property Editor**: Full-featured modal for editing all component properties
- **Quick Edit Overlay**: Inline editing for common properties

## Pre-Built Injectable Components

### Blogging UI Components

#### Callout Box
Highlight important information with colored callout boxes:
```typescript
@Input() type: 'info' | 'warning' | 'success' | 'error' = 'info';
@Input() title = '';
@Input() content = '';
```

#### Code Snippet
Display formatted code with syntax highlighting:
```typescript
@Input() title = '';
@Input() language = 'javascript';
@Input() code = '';
```

#### Image Gallery
Create responsive image galleries:
```typescript
@Input() title = '';
@Input() columns: 1 | 2 | 3 | 4 = 3;
@Input() images: Array<{ url: string; alt?: string; caption?: string }> = [];
```

### Common UI Components

#### Card
Styled container for organizing content:
```typescript
@Input() glassEffect = false;
@Input() CardVariant: 'default' | 'glass' | 'gradient' = 'default';
```

#### Button
Interactive button with style variants:
```typescript
@Input() variant: 'primary' | 'secondary' | 'outlined' | 'warning' | 'danger' = 'primary';
@Input() disabled = false;
```

#### Accordion
Collapsible sections for content organization:
```typescript
@Input() sections: { heading: string; content?: string }[] = [];
@Input() variant: 'default' | 'glass' | 'gradient' = 'default';
```

### Form UI Components

#### Text Input
Single-line text input with labels:
```typescript
@Input() type: 'text' | 'password' | 'date' = 'text';
@Input() label = '';
@Input() placeholder = '';
```

#### Select
Dropdown selection:
```typescript
@Input() options: { value: string; label: string }[] = [];
```

#### Radio Button
Single selection within a group:
```typescript
@Input() options: { label: string; value: string }[] = [];
@Input() layout: 'vertical' | 'horizontal' | 'grid' = 'vertical';
```

## Usage Example

```typescript
// In your component
import { BlogComposeComponent } from '@optimistic-tanuki/blogging-ui';

@Component({
  template: `
    <lib-blog-compose 
      (postSubmitted)="onPostSubmitted($event)">
    </lib-blog-compose>
  `
})
export class MyBlogPage {
  onPostSubmitted(postData: any): void {
    console.log('Post with injected components:', postData);
    // postData.injectedComponents contains all active component instances
  }
}
```

## Creating Custom Injectable Components

1. Create your Angular component:
```typescript
@Component({
  selector: 'my-custom-component',
  standalone: true,
  template: `<div>{{ customData }}</div>`
})
export class MyCustomComponent {
  @Input() customData = 'Default content';
}
```

2. Register it with the injection system:
```typescript
const blogCompose = // get reference to BlogComposeComponent
blogCompose.registerComponent({
  id: 'my-custom',
  name: 'My Custom Component',
  description: 'A custom component for special content',
  component: MyCustomComponent,
  category: 'Custom',
  icon: 'star',
  data: { customData: 'Initial value' }
});
```

3. Define property configuration (optional, for property editor):
```typescript
// In component-properties.config.ts
export const COMPONENT_PROPERTY_DEFINITIONS = {
  'my-custom': [
    {
      key: 'customData',
      type: 'string',
      label: 'Custom Data',
      description: 'The data to display',
      defaultValue: 'Default content'
    }
  ]
};
```

## Benefits

1. **Modularity**: Components are self-contained and reusable
2. **Extensibility**: Easy to add new component types without modifying core editor
3. **Type Safety**: Full TypeScript support with proper interfaces
4. **Performance**: Components use Angular's native rendering and change detection
5. **Flexibility**: Components can be positioned, updated, and removed dynamically
6. **Integration**: Seamlessly integrates with existing TipTap editor functionality
7. **Multi-Library Support**: Use components from Blogging UI, Common UI, and Form UI

## Files Structure

```
libs/blogging-ui/src/lib/blog-compose/
├── interfaces/
│   └── component-injection.interface.ts    # Core interfaces and types
├── services/
│   └── component-injection.service.ts      # Main injection service
├── components/
│   ├── component-selector.component.ts     # Component selection UI
│   ├── component-wrapper.component.ts      # Basic wrapper component
│   ├── component-editor-wrapper.component.ts  # Enhanced editing wrapper
│   ├── property-editor.component.ts        # Full property editor modal
│   └── example-components/                 # Pre-built example components
│       ├── callout-box.component.ts
│       ├── code-snippet.component.ts
│       └── image-gallery.component.ts
├── configs/
│   └── component-properties.config.ts      # Property definitions for all components
├── extensions/
│   └── angular-component-node.extension.ts # TipTap extension for inline components
└── blog-compose.component.ts               # Main component with injection integration
```

This implementation provides both programmatic APIs and user-friendly interfaces for component injection, making it easy to extend blog posts with rich, interactive content from multiple UI libraries.
