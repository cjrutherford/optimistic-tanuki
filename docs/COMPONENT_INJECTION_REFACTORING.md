# Component Injection System Refactoring

## Overview

This document describes the comprehensive refactoring of the component injection system to follow FIRST principles and simplify the architecture.

## Problem Statement

The current implementation is too complex with scattered responsibilities:
- Component injection service in blogging-ui (should be centralized)
- Component-specific logic mixed with editor logic
- No clear separation between editor extension and data persistence
- Complex component wrapper with many responsibilities
- No standardized way to emit component data for saving

## FIRST Principles Applied

- **Fast**: Minimize overhead by centralizing extension logic
- **Independent**: Decouple TipTap extension from component rendering
- **Repeatable**: Create reusable extension for both blogging-ui and social-ui
- **Self-validating**: Extension validates component data structure
- **Timely**: Clear data flow from editor → save → database → viewer

## Architecture

### Before

```
blogging-ui/ComponentInjectionService
    ↓
Manages components, ViewContainerRef, callbacks
    ↓
AngularComponentNode extension (tightly coupled)
    ↓
ComponentEditorWrapperComponent (complex)
    ↓
No clear data extraction for saving
```

### After

```
┌─────────────────────────────────────────────────────────────┐
│                    compose-lib                               │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ComponentInjection Extension (TipTap Plugin)      │     │
│  │  - Insert component nodes                          │     │
│  │  - Track component instances                        │     │
│  │  - getInjectedComponents() → ComponentData[]       │     │
│  │  - Emit events on changes                          │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
         ↓ used by                    ↓ used by
┌──────────────────┐          ┌──────────────────┐
│   blogging-ui    │          │    social-ui     │
│  blog-compose    │          │  social-compose  │
│  - Uses extension│          │  - Uses extension│
│  - Emits data    │          │  - Emits data    │
└──────────────────┘          └──────────────────┘
         ↓ saves                     ↓ saves
┌──────────────────┐          ┌──────────────────┐
│  BlogComponent   │          │  SocialComponent │
│  (DB Entity)     │          │  (DB Entity)     │
└──────────────────┘          └──────────────────┘
         ↓ loaded by                 ↓ loaded by
┌──────────────────┐          ┌──────────────────┐
│   blog-viewer    │          │   social-viewer  │
│  - Load from API │          │  - Load from API │
│  - Reconstruct   │          │  - Reconstruct   │
└──────────────────┘          └──────────────────┘
```

## Implementation Phases

### Phase 1: Create Centralized TipTap Plugin ✅

**Status**: COMPLETE

Created `ComponentInjection` extension in `libs/compose-lib`:

#### Key Features

1. **Simple Data Model**
```typescript
interface InjectedComponentData {
  instanceId: string;       // Unique identifier
  componentType: string;    // Component type name
  componentData: Record;    // Component properties
  position?: number;        // Optional position
}
```

2. **Clean Commands API**
- `insertComponent()` - Add component to editor
- `updateComponent()` - Update component data
- `removeComponent()` - Remove component
- `getInjectedComponents()` - Extract all components

3. **Event System**
- `onComponentsChanged` - Fires when components change
- `onComponentClick` - Fires when component clicked
- `onComponentEdit` - Fires when edit requested

4. **Simple HTML Structure**
```html
<div data-injected-component
     data-instance-id="btn-123"
     data-component-type="button"
     data-component-data='{"text":"Click Me"}'>
  <div class="component-placeholder">
    Component: button (btn-123)
  </div>
</div>
```

#### Files Created
- `libs/compose-lib/src/lib/extensions/component-injection.extension.ts`
- Exported in `libs/compose-lib/src/index.ts`

### Phase 2: Backend Infrastructure

#### Blog Components ✅

**Status**: COMPLETE (Already existed)

Backend infrastructure for blog components:
- ✅ `BlogComponent` entity with JSONB data storage
- ✅ `BlogComponentService` with full CRUD operations
- ✅ `BlogComponentController` with RPC endpoints
- ✅ DTOs in @optimistic-tanuki/models
- ✅ Commands in @optimistic-tanuki/constants

**Files**:
- `apps/blogging/src/app/entities/blog-component.entity.ts`
- `apps/blogging/src/app/services/blog-component.service.ts`
- `apps/blogging/src/app/controllers/blog-component.controller.ts`
- `libs/models/src/lib/libs/blog/blog-component.ts`

**Available Commands**:
- `BlogComponentCommands.CREATE`
- `BlogComponentCommands.FIND_BY_POST`
- `BlogComponentCommands.UPDATE`
- `BlogComponentCommands.DELETE`
- `BlogComponentCommands.DELETE_BY_POST`
- `BlogComponentCommands.FIND_BY_QUERY`

#### Social Components ✅

**Status**: DTOs & Commands COMPLETE, Entity/Service/Controller TODO

Created DTOs and commands:
- ✅ `SocialComponentDto` DTOs in @optimistic-tanuki/models
- ✅ `SocialComponentDto` DTOs in @optimistic-tanuki/ui-models
- ✅ `SocialComponentCommands` in @optimistic-tanuki/constants
- ⏳ `SocialComponent` entity (TODO)
- ⏳ `SocialComponentService` (TODO)
- ⏳ `SocialComponentController` (TODO)
- ⏳ Migration for social_components table (TODO)

**Files Created**:
- `libs/models/src/lib/libs/social/social-component.ts`
- `libs/ui-models/src/lib/ui-models/social-component.ts`
- `libs/constants/src/lib/libs/social.ts` (updated)

**Commands Defined**:
- `SocialComponentCommands.CREATE`
- `SocialComponentCommands.UPDATE`
- `SocialComponentCommands.DELETE`
- `SocialComponentCommands.FIND`
- `SocialComponentCommands.FIND_BY_POST`
- `SocialComponentCommands.DELETE_BY_POST`
- `SocialComponentCommands.FIND_BY_QUERY`

### Phase 3: Simplify Blog Compose Component

**Status**: TODO

Tasks:
- [ ] Replace ComponentInjectionService with new extension
- [ ] Remove complex component-specific imports
- [ ] Add `@Output() componentsChanged` to emit component data
- [ ] Use simplified extension configuration
- [ ] Clean up template and remove unnecessary complexity
- [ ] Update save logic to use `getInjectedComponents()`
- [ ] Save components to backend via BlogComponentService

### Phase 4: Update Blog Viewer

**Status**: TODO

Tasks:
- [ ] Load components from API on post load
- [ ] Match instanceIds in DOM to loaded component data
- [ ] Dynamically create components to replace placeholders
- [ ] Use component map to create correct component types
- [ ] Set component properties from loaded data

### Phase 5: Implement Social Service Backend

**Status**: TODO

Tasks:
- [ ] Create `SocialComponent` entity (TypeORM)
- [ ] Create migration for social_components table
- [ ] Create `SocialComponentService` with CRUD operations
- [ ] Create `SocialComponentController` with RPC message handlers
- [ ] Register in social module
- [ ] Test CRUD operations

### Phase 6: Update Social Compose

**Status**: TODO

Tasks:
- [ ] Add ComponentInjection extension
- [ ] Add `@Output() componentsChanged` event
- [ ] Update save logic to save components
- [ ] Test component insertion and saving

### Phase 7: Create/Update Social Viewer

**Status**: TODO

Tasks:
- [ ] Create or update social-viewer component
- [ ] Load components from API
- [ ] Reconstruct components from data
- [ ] Test viewing posts with components

## Data Flow

### Creating/Editing Posts

```
User inserts component
    ↓
ComponentInjection extension stores in editor state
    ↓
onComponentsChanged fires with updated list
    ↓
Parent component stores component list
    ↓
User saves post
    ↓
getInjectedComponents() extracts all components
    ↓
Post content saved to posts table
    ↓
Each component saved to blog_components/social_components table
    ↓
Success
```

### Viewing Posts

```
Viewer loads post
    ↓
Load post content (HTML)
    ↓
Load components from API (blog_components/social_components)
    ↓
Find [data-injected-component] nodes in DOM
    ↓
Match instanceId to loaded component data
    ↓
Create component instance with ViewContainerRef
    ↓
Set component properties from componentData
    ↓
Replace placeholder with rendered component
    ↓
Display complete post with interactive components
```

## Benefits

### Centralized
- One extension in compose-lib
- Reusable across multiple UIs
- Consistent behavior

### Separated
- Clear boundaries between editor, persistence, viewing
- Extension doesn't know about database
- Service doesn't know about editor

### Testable
- Each piece independently testable
- Mock-friendly interfaces
- Clear data contracts

### Maintainable
- Simpler code, easier to understand
- FIRST principles reduce complexity
- Focused responsibilities

## Migration Strategy

### For Existing Posts

Posts created with old system:
- Have components embedded in HTML with data attributes
- Can be left as-is (backward compatible)
- OR run migration script to extract and save to database
- New system will handle both formats

### For New Posts

All new posts will:
- Use ComponentInjection extension
- Save components to separate table
- Maintain clean HTML in posts table
- Reconstruct on viewing

## Testing Strategy

### Unit Tests
- ComponentInjection extension commands
- Service CRUD operations
- DTO validation

### Integration Tests
- Full save flow (editor → database)
- Full load flow (database → viewer)
- Component reconstruction

### E2E Tests
- Create post with components
- Edit post components
- View post with components
- Delete post (cascade to components)

## Next Immediate Steps

1. Create SocialComponent entity, service, controller
2. Create migration for social_components table
3. Update blog-compose to use new extension
4. Update blog-viewer to load and reconstruct components
5. Test complete blog flow
6. Update social-compose similarly
7. Update social-viewer similarly
8. Test complete social flow

## Success Criteria

- ✅ Centralized extension in compose-lib
- ✅ Blog component backend infrastructure
- ✅ Social component DTOs and commands
- ⏳ Blog compose using new extension
- ⏳ Social component backend infrastructure
- ⏳ Blog viewer reconstructing components
- ⏳ Social compose using new extension
- ⏳ Social viewer reconstructing components
- ⏳ Full E2E tests passing
