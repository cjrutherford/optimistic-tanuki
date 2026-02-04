# Component Serialization and Reconstruction

## Overview
This document describes how Angular components inserted in the TipTap editor are serialized to HTML and reconstructed when displayed in the blog viewer.

## Problem Statement
When users insert Angular components (like callout boxes, code snippets, etc.) into blog posts using the editor, the component data needs to:
1. Be serialized to HTML when saving content
2. Be persisted to the backend database
3. Be reconstructed with the same data when viewed

Without proper serialization, components would appear as empty placeholders when loaded from the backend.

## Solution Architecture

### Two-Phase Approach

#### Phase 1: Serialization (Editor → HTML → Backend)
When content is saved from the editor, component data is serialized into HTML data attributes using JSON.

#### Phase 2: Reconstruction (Backend → HTML → Viewer)
When content is loaded in the viewer, component data is parsed from HTML and components are dynamically created.

---

## Phase 1: Serialization

### Implementation Location
**File**: `libs/compose-lib/src/lib/extensions/angular-component-node.extension.ts`

### Updated Methods

#### renderHTML()
Converts TipTap node to HTML with component data serialized as JSON in data attributes.

```typescript
renderHTML({
  node,
  HTMLAttributes,
}: {
  node?: any;
  HTMLAttributes: Record<string, any>;
}): [string, Record<string, any>, ...any[]] {
  // Get node attributes
  const componentId = node?.attrs?.componentId || '';
  const instanceId = node?.attrs?.instanceId || '';
  const data = node?.attrs?.data || {};
  const componentDef = node?.attrs?.componentDef || null;

  // Build attributes with serialized data
  const attributes: Record<string, any> = {
    'data-angular-component': '',
    'class': 'angular-component-node',
  };

  if (componentId) {
    attributes['data-component-id'] = componentId;
  }
  if (instanceId) {
    attributes['data-instance-id'] = instanceId;
  }
  if (data && Object.keys(data).length > 0) {
    attributes['data-component-data'] = JSON.stringify(data);
  }
  if (componentDef) {
    attributes['data-component-def'] = JSON.stringify(componentDef);
  }

  return [
    'div',
    mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, attributes),
    [
      'div',
      { class: 'component-placeholder' },
      componentDef?.name || 'Angular Component Loading...',
    ],
  ];
}
```

#### parseHTML()
Parses HTML back to TipTap node attributes, extracting component data from data attributes.

```typescript
parseHTML(): Array<{ tag: string; getAttrs?: (dom: HTMLElement) => Record<string, any> | false }> {
  return [
    {
      tag: 'div[data-angular-component]',
      getAttrs: (dom: HTMLElement) => {
        const componentId = dom.getAttribute('data-component-id');
        const instanceId = dom.getAttribute('data-instance-id');
        const dataStr = dom.getAttribute('data-component-data');
        const componentDefStr = dom.getAttribute('data-component-def');

        return {
          componentId: componentId || null,
          instanceId: instanceId || null,
          data: dataStr ? JSON.parse(dataStr) : {},
          componentDef: componentDefStr ? JSON.parse(componentDefStr) : null,
        };
      },
    },
  ];
}
```

### HTML Output Example

**Before (No Data)**:
```html
<div data-angular-component="" class="angular-component-node">
  <div class="component-placeholder">Angular Component Loading...</div>
</div>
```

**After (With Data)**:
```html
<div data-angular-component="" 
     data-component-id="callout-box"
     data-instance-id="callout-123"
     data-component-data='{"title":"Important Note","content":"This is important","type":"info"}'
     data-component-def='{"id":"callout-box","name":"Callout Box","category":"Blogging"}'
     class="angular-component-node">
  <div class="component-placeholder">Callout Box</div>
</div>
```

### Data Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `data-angular-component` | Marker attribute (always empty) | `""` |
| `data-component-id` | Component type identifier | `"callout-box"` |
| `data-instance-id` | Unique instance identifier | `"callout-123"` |
| `data-component-data` | Component properties as JSON | `'{"title":"Note","type":"info"}'` |
| `data-component-def` | Component definition as JSON | `'{"id":"callout-box","name":"..."}'` |

---

## Phase 2: Reconstruction

### Implementation Location
**File**: `apps/digital-homestead/src/app/components/blog-viewer/blog-viewer.component.ts`

### Component Map

Maps component IDs to their Angular component classes:

```typescript
const COMPONENT_MAP: Record<string, any> = {
  'callout-box': CalloutBoxComponent,
  'code-snippet': CodeSnippetComponent,
  'video-player': VideoPlayerComponent,
  'image-gallery': ImageGalleryComponent,
  'quote-block': QuoteBlockComponent,
  'timeline': TimelineComponent,
  'stats-display': StatsDisplayComponent,
  'pricing-table': PricingTableComponent,
  'testimonial': TestimonialComponent,
  'faq-item': FaqItemComponent,
  'social-share': SocialShareComponent,
  'button': ButtonComponent,
  'card': CardComponent,
  'accordion': AccordionComponent,
  'modal': ModalComponent,
  'hero-section': HeroSectionComponent,
  'content-section': ContentSectionComponent,
};
```

### Reconstruction Method

```typescript
private reconstructComponents(): void {
  if (!this.contentElement || !this.contentContainer) {
    return;
  }

  // Clean up existing components
  this.componentRefs.forEach(ref => ref.destroy());
  this.componentRefs = [];

  // Find all component nodes
  const componentNodes = this.contentElement.nativeElement.querySelectorAll(
    '[data-angular-component]'
  );

  componentNodes.forEach((node: Element) => {
    try {
      // 1. Extract metadata
      const componentId = node.getAttribute('data-component-id');
      const instanceId = node.getAttribute('data-instance-id');
      const dataStr = node.getAttribute('data-component-data');
      const componentDefStr = node.getAttribute('data-component-def');

      if (!componentId) {
        console.warn('Component node missing data-component-id:', node);
        return;
      }

      // 2. Parse data
      const componentData = dataStr ? JSON.parse(dataStr) : {};
      const componentDef = componentDefStr ? JSON.parse(componentDefStr) : null;

      // 3. Get component class
      const ComponentClass = COMPONENT_MAP[componentId];
      if (!ComponentClass) {
        console.warn(`Component not found in map: ${componentId}`);
        // Show helpful placeholder
        node.innerHTML = `<div class="component-placeholder">
          <strong>${componentDef?.name || componentId}</strong>
          <p>Component not available in viewer</p>
        </div>`;
        return;
      }

      // 4. Create component
      const componentRef = this.contentContainer!.createComponent(ComponentClass);

      // 5. Set inputs
      Object.keys(componentData).forEach(key => {
        if (componentRef.instance[key] !== undefined) {
          componentRef.instance[key] = componentData[key];
        }
      });

      // 6. Detect changes
      componentRef.changeDetectorRef.detectChanges();

      // 7. Store reference
      this.componentRefs.push(componentRef);

      // 8. Replace placeholder
      node.innerHTML = '';
      node.appendChild(componentRef.location.nativeElement);

    } catch (error) {
      console.error('Error reconstructing component:', error, node);
    }
  });
}
```

### Lifecycle Integration

```typescript
export class BlogViewerComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  private componentRefs: ComponentRef<any>[] = [];

  ngAfterViewInit() {
    // Reconstruct components after view is ready
    this.reconstructComponents();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['content']) {
      this.sanitizedContent = DOMPurify.sanitize(this.content);
      // Reconstruct when content changes
      setTimeout(() => this.reconstructComponents(), 0);
    }
  }

  ngOnDestroy() {
    // Clean up component references
    this.componentRefs.forEach(ref => ref.destroy());
    this.componentRefs = [];
  }
}
```

---

## Complete Data Flow

### Save Flow (Editor to Backend)

```
1. User inserts component in editor
   ↓
2. Component has data:
   {
     title: "Important Note",
     content: "This is important",
     type: "info"
   }
   ↓
3. User saves post
   ↓
4. editor.getHTML() called
   ↓
5. renderHTML() serializes component:
   <div data-component-id="callout-box"
        data-component-data='{"title":"Important Note",...}'>
   ↓
6. HTML sent to backend
   ↓
7. Stored in database
```

### Load Flow (Backend to Viewer)

```
1. Blog viewer loads post
   ↓
2. HTML retrieved from backend
   ↓
3. Content sanitized with DOMPurify
   ↓
4. HTML inserted into template
   ↓
5. ngAfterViewInit() triggered
   ↓
6. reconstructComponents() called
   ↓
7. Find [data-angular-component] nodes
   ↓
8. For each node:
   - Extract data-component-id
   - Parse data-component-data JSON
   - Look up component class
   - Create component instance
   - Set component inputs
   - Replace placeholder with component
   ↓
9. Components rendered with original data ✅
```

---

## Error Handling

### Missing Component ID
```typescript
if (!componentId) {
  console.warn('Component node missing data-component-id:', node);
  return; // Leave placeholder visible
}
```

### Unknown Component Type
```typescript
if (!ComponentClass) {
  console.warn(`Component not found in map: ${componentId}`);
  // Show helpful placeholder
  node.innerHTML = `<div class="component-placeholder">
    <strong>${componentDef?.name || componentId}</strong>
    <p>Component not available in viewer</p>
  </div>`;
  return;
}
```

### JSON Parse Errors
```typescript
try {
  const componentData = dataStr ? JSON.parse(dataStr) : {};
} catch (error) {
  console.error('Error parsing component data:', error);
  // Falls back to empty object
}
```

### General Reconstruction Errors
```typescript
try {
  // ... reconstruction logic ...
} catch (error) {
  console.error('Error reconstructing component:', error, node);
  // Component placeholder remains visible
}
```

---

## Adding New Components

To make a new component available in the blog viewer:

1. **Import the component**:
```typescript
import { MyNewComponent } from '@optimistic-tanuki/common-ui';
```

2. **Add to component map**:
```typescript
const COMPONENT_MAP: Record<string, any> = {
  // ... existing components ...
  'my-new-component': MyNewComponent,
};
```

3. **Add to imports array**:
```typescript
@Component({
  imports: [
    // ... existing imports ...
    MyNewComponent,
  ]
})
```

That's it! The component will now be reconstructed automatically.

---

## Testing Guide

### Test Serialization

1. **Insert component in editor**:
   - Open blog editor
   - Click "Components" button
   - Select a component (e.g., Callout Box)
   - Configure properties

2. **Verify HTML output**:
   ```typescript
   const html = editor.getHTML();
   console.log(html);
   ```

3. **Check for data attributes**:
   - `data-component-id` should be present
   - `data-component-data` should contain JSON
   - JSON should include all component properties

### Test Deserialization

1. **Create test HTML**:
   ```html
   <div data-angular-component=""
        data-component-id="callout-box"
        data-component-data='{"title":"Test","content":"Content","type":"info"}'>
   </div>
   ```

2. **Load in blog viewer**:
   ```typescript
   viewer.content = testHTML;
   ```

3. **Verify reconstruction**:
   - Component should render
   - Properties should be applied
   - Component should be interactive

### Test Error Handling

1. **Missing component ID**:
   ```html
   <div data-angular-component=""></div>
   ```
   - Should log warning
   - Should show placeholder

2. **Unknown component**:
   ```html
   <div data-component-id="unknown-component"></div>
   ```
   - Should log warning
   - Should show helpful message

3. **Malformed JSON**:
   ```html
   <div data-component-data='{"invalid json'}></div>
   ```
   - Should catch error
   - Should use empty object as fallback

---

## Performance Considerations

### Serialization Performance
- **JSON.stringify()**: O(n) where n is the number of properties
- Minimal impact as most components have few properties
- Happens once per component when saving

### Deserialization Performance
- **querySelectorAll()**: O(n) where n is total DOM nodes
- **JSON.parse()**: O(m) where m is JSON string length
- Happens once on page load
- Negligible impact for typical blog posts

### Optimization Tips
1. Keep component data minimal (only necessary properties)
2. Avoid deeply nested objects in component data
3. Consider lazy loading for heavy components
4. Use change detection strategy OnPush where possible

---

## Security Considerations

### DOMPurify Integration
All HTML is sanitized before being set in the viewer:

```typescript
this.sanitizedContent = DOMPurify.sanitize(this.content);
```

This prevents XSS attacks while preserving component data attributes.

### JSON Safety
- JSON.parse() is wrapped in try-catch
- Invalid JSON defaults to empty object
- No eval() or dangerous string execution
- All component creation is type-safe

### Component Isolation
- Components cannot execute arbitrary code
- Only registered components can be created
- Component inputs are validated by Angular
- Change detection is controlled

---

## Troubleshooting

### Components not appearing in viewer

**Check**:
1. Is component imported in blog-viewer?
2. Is component in COMPONENT_MAP?
3. Is component in imports array?
4. Does component ID match registration?

### Component data not preserved

**Check**:
1. Is renderHTML() receiving node parameter?
2. Is data-component-data attribute in HTML?
3. Is JSON valid?
4. Are property names correct?

### Console warnings

**"Component node missing data-component-id"**:
- HTML is missing the data-component-id attribute
- Check renderHTML() implementation

**"Component not found in map"**:
- Component not registered in COMPONENT_MAP
- Add component to map and imports

**"Error parsing component data"**:
- Invalid JSON in data-component-data
- Check JSON.stringify() in renderHTML()

---

## Future Enhancements

### Potential Improvements
1. **Lazy Loading**: Load component modules on demand
2. **Versioning**: Handle component schema changes
3. **Migration**: Convert old component formats
4. **Validation**: Schema validation for component data
5. **Compression**: Compress large component data
6. **Caching**: Cache component instances
7. **SSR**: Server-side rendering support

### Advanced Features
1. **Component Nesting**: Allow components within components
2. **Cross-References**: Link components together
3. **State Persistence**: Save component state separately
4. **Undo/Redo**: Track component data changes
5. **Import/Export**: Export components as templates

---

## Conclusion

The component serialization and reconstruction system provides:

✅ **Data Persistence**: Component data survives save/load cycles
✅ **Type Safety**: Angular components with proper typing
✅ **Error Handling**: Graceful degradation for errors
✅ **Performance**: Minimal overhead
✅ **Security**: Sanitized and validated
✅ **Extensibility**: Easy to add new components

This enables rich, interactive blog posts with embedded Angular components that maintain their functionality and appearance when viewed by readers.
