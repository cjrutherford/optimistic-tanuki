# Angular Content Projection System for Blog Compose Component

This implementation adds a powerful Angular content projection system to the `blog-compose` component that allows users to inject custom Angular components dynamically into the blog editor.

## Features

### 1. Component Registration System
- Register custom Angular components that can be injected into the editor
- Components are organized by categories (e.g., 'Content', 'Media', 'Interactive')
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

### 3. Content Projection Areas
- Dedicated container for injected components with visual feedback
- Components are rendered in their own Angular context with full lifecycle support
- Drag and drop positioning support

### 4. User Interface Integration
- **Component Selector Modal**: Browse and select from available components
- **Toolbar Integration**: Easy access button in the TipTap editor toolbar
- **Visual Container**: Clear indication of where components will be injected

## Example Components Included

### 1. Callout Box Component
Highlight important information with colored callout boxes:
```typescript
@Input() type: 'info' | 'warning' | 'success' | 'error' = 'info';
@Input() title = '';
@Input() content = '';
```

### 2. Code Snippet Component
Display formatted code with syntax highlighting:
```typescript
@Input() title = '';
@Input() language = 'javascript';
@Input() code = '';
```

### 3. Image Gallery Component
Create responsive image galleries:
```typescript
@Input() title = '';
@Input() columns: 1 | 2 | 3 | 4 = 3;
@Input() images: Array<{ url: string; alt?: string; caption?: string }> = [];
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

## Benefits

1. **Modularity**: Components are self-contained and reusable
2. **Extensibility**: Easy to add new component types without modifying core editor
3. **Type Safety**: Full TypeScript support with proper interfaces
4. **Performance**: Components use Angular's native rendering and change detection
5. **Flexibility**: Components can be positioned, updated, and removed dynamically
6. **Integration**: Seamlessly integrates with existing TipTap editor functionality

## Files Structure

```
libs/blogging-ui/src/lib/blog-compose/
├── interfaces/
│   └── component-injection.interface.ts    # Core interfaces and types
├── services/
│   └── component-injection.service.ts      # Main injection service
├── components/
│   ├── component-selector.component.ts     # Component selection UI
│   └── example-components/                 # Pre-built example components
│       ├── callout-box.component.ts
│       ├── code-snippet.component.ts
│       └── image-gallery.component.ts
└── blog-compose.component.ts               # Main component with injection integration
```

This implementation provides both programmatic APIs and user-friendly interfaces for component injection, making it easy to extend blog posts with rich, interactive content.
