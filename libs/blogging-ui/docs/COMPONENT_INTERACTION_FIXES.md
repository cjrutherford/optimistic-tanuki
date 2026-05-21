# Injected Component Interaction Fixes

## Overview
This document describes the fixes implemented to resolve two critical issues with injected components in the TipTap editor:
1. Components being deleted when typing around them
2. Quick-edit forms losing focus and properties not persisting

## Problems Identified

### Problem 1: Components Deleted by Typing
**Symptom**: When typing before, after, or near an injected component, the component would be deleted or overwritten with text.

**Root Cause**: The component-editor-wrapper didn't have `contenteditable="false"`, so TipTap treated it as regular editable content. This allowed the editor to:
- Delete components when typing
- Replace components with text
- Merge component nodes into text nodes

### Problem 2: Form Focus Loss and Data Not Persisting
**Symptoms**:
- Clicking in quick-edit form inputs would immediately blur
- Typing in forms would sometimes lose focus
- Property changes wouldn't persist after saving

**Root Causes**:
1. **Focus Loss**: TipTap's editor was capturing mousedown events from the overlay, preventing forms from getting focus
2. **No Persistence**: The `updateAngularComponent` command wasn't dispatching transactions, so changes never committed to editor state
3. **Poor Sync**: Node view updates weren't properly syncing back to wrapper component

## Solutions Implemented

### Solution 1: Contenteditable Control

**File**: `component-editor-wrapper.component.ts`

**Changes**:
```html
<!-- Wrapper: Prevent TipTap editing -->
<div class="component-editor-wrapper" contenteditable="false">
  
  <!-- Quick Edit Overlay: Allow form input -->
  <div class="quick-edit-overlay" contenteditable="true">
    <input type="text" /> <!-- Can type here -->
  </div>
</div>
```

**How it Works**:
- `contenteditable="false"` on wrapper prevents TipTap from treating component as text
- `contenteditable="true"` on overlay re-enables editing within forms
- TipTap respects these boundaries and won't delete the component

**Result**: ✅ Components are protected from accidental deletion

### Solution 2: Prevent Focus Capture

**File**: `component-editor-wrapper.component.ts`

**Added Event Handler**:
```typescript
onOverlayMouseDown(event: MouseEvent): void {
  // Prevent TipTap editor from capturing focus
  event.stopPropagation();
}
```

**HTML**:
```html
<div class="quick-edit-overlay" 
     (mousedown)="onOverlayMouseDown($event)">
```

**How it Works**:
- Mousedown events are stopped before reaching TipTap's event handlers
- Form inputs can receive focus normally
- TipTap doesn't interfere with form interactions

**Result**: ✅ Forms maintain focus and are fully usable

### Solution 3: Dispatch Transactions

**File**: `angular-component-node.extension.ts`

**Before**:
```typescript
updateAngularComponent: (options) => ({ tr, state }) => {
  doc.descendants((node, pos) => {
    if (node.attrs['instanceId'] === options.instanceId) {
      tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        data: options.data,
      });
      updated = true;
    }
  });
  return updated; // ❌ Transaction never committed!
}
```

**After**:
```typescript
updateAngularComponent: (options) => 
  ({ tr, state, dispatch }) => {
    doc.descendants((node, pos) => {
      if (node.attrs['instanceId'] === options.instanceId) {
        tr.setNodeMarkup(pos, undefined, {
          ...node.attrs,
          data: options.data,
        });
        updated = true;
      }
    });
    
    // ✅ Actually commit the transaction
    if (updated && dispatch) {
      dispatch(tr);
    }
    
    return updated;
  }
```

**How it Works**:
- `dispatch` parameter receives the editor's dispatch function
- Calling `dispatch(tr)` commits the transaction to editor state
- Editor state is updated, changes are persisted

**Result**: ✅ Property changes save reliably

### Solution 4: Bidirectional Sync

**File**: `angular-component-node.extension.ts`

**Node View Update Method**:
```typescript
update: (updatedNode) => {
  if (updatedNode.type.name !== this.name) {
    return false;
  }

  const newData = updatedNode.attrs['data'];
  if (instance && instance.componentRef) {
    // ✅ Update wrapper's componentData property
    const wrapperInstance = instance.componentRef.instance;
    wrapperInstance.componentData = { 
      ...wrapperInstance.componentData, 
      ...newData 
    };
    
    // ✅ Update instance data
    instance.data = { ...instance.data, ...newData };

    // ✅ Trigger change detection
    if (instance.componentRef.changeDetectorRef) {
      instance.componentRef.changeDetectorRef.detectChanges();
    }
  }
  return true;
}
```

**How it Works**:
- When TipTap node updates, the wrapper component is notified
- Wrapper's `componentData` property is updated
- Angular change detection runs
- UI reflects the new state

**Result**: ✅ TipTap and wrapper stay in sync

### Solution 5: Smart Component Updates

**File**: `component-editor-wrapper.component.ts`

**New Public Method**:
```typescript
public updateComponentData(newData: Record<string, any>): void {
  this.componentData = { ...this.componentData, ...newData };
  
  // Don't overwrite editing data if user is currently editing
  if (!this.isEditing) {
    this.editingData = { ...this.componentData };
  }
  
  this.updateDynamicComponent();
}
```

**Improved Private Method**:
```typescript
private updateDynamicComponent(): void {
  if (!this.dynamicComponentRef) return;

  // Use only componentData, not editingData
  // editingData is for the quick-edit form only
  const data = {
    ...this.componentDef.data,
    ...this.componentData,
  };
  
  Object.keys(data).forEach((key) => {
    if (this.dynamicComponentRef!.instance[key] !== undefined) {
      this.dynamicComponentRef!.instance[key] = data[key];
    }
  });

  this.dynamicComponentRef.changeDetectorRef.detectChanges();
}
```

**How it Works**:
- External updates use the public `updateComponentData()` method
- If user is editing, their changes aren't overwritten
- Component always reflects the latest committed data
- No race conditions

**Result**: ✅ Updates work reliably without conflicts

### Solution 6: Service Integration

**File**: `component-injection.service.ts`

**Improved updateComponent Method**:
```typescript
updateComponent(instanceId: string, data: any): void {
  const instance = this.activeComponents.get(instanceId);
  if (!instance) {
    throw new Error(`Component instance '${instanceId}' not found.`);
  }

  const oldData = { ...instance.data };
  instance.data = { ...instance.data, ...data };

  const wrapperInstance = instance.componentRef.instance;
  if (wrapperInstance) {
    // ✅ Use public API
    if (typeof wrapperInstance.updateComponentData === 'function') {
      wrapperInstance.updateComponentData(data);
    } else {
      // Fallback for compatibility
      if (wrapperInstance.componentData) {
        wrapperInstance.componentData = { 
          ...wrapperInstance.componentData, 
          ...data 
        };
      }
    }
  }

  instance.componentRef.changeDetectorRef.detectChanges();
  
  this.componentEvents.emit({
    type: 'updated',
    instance,
    oldData,
  });
}
```

**How it Works**:
- Prefers using the public `updateComponentData()` method
- Falls back to direct property update if needed
- Maintains backward compatibility
- Emits events for observers

**Result**: ✅ Clean API with proper encapsulation

## Data Flow

### Complete Update Flow

```
User saves quick-edit changes
        ↓
saveQuickEdit() in wrapper
        ↓
propertiesChanged.emit({ instance, data })
        ↓
onComponentPropertiesChanged() in blog-compose
        ↓
┌───────────────────────────────┐
│ componentInjectionService     │
│   .updateComponent()          │
│   → Updates wrapper via       │
│     updateComponentData()     │
└───────────────────────────────┘
        ↓
┌───────────────────────────────┐
│ editor.commands               │
│   .updateAngularComponent()   │
│   → Creates transaction       │
│   → dispatch(tr) ✅           │
│   → Commits to editor state   │
└───────────────────────────────┘
        ↓
Node view update() called
        ↓
Wrapper synced with TipTap state
        ✓
Changes persisted ✅
```

### Event Propagation Control

```
User clicks input in quick-edit overlay
        ↓
onOverlayMouseDown(event)
        ↓
event.stopPropagation() ✅
        ↓
TipTap doesn't receive event
        ↓
Input gets focus normally
        ↓
User can type freely ✅
```

### Contenteditable Hierarchy

```
TipTap Editor (contenteditable="true")
    ↓
Component Wrapper (contenteditable="false") ← Protected from editing
    ↓
    ├─ Control Bar (contenteditable="false") ← Not editable
    ├─ Component Content (contenteditable="false") ← Not editable
    └─ Quick Edit Overlay (contenteditable="true") ← Editable
        └─ Form Inputs (contenteditable="inherit") ← Can type here
```

## Testing Guide

### Test 1: Typing Around Components
**Steps**:
1. Insert a component in editor
2. Click before the component
3. Type text
4. Click after the component
5. Type text

**Expected**:
- ✅ Component remains intact
- ✅ Text appears before/after component
- ✅ Component is not deleted or corrupted

### Test 2: Quick Edit Forms
**Steps**:
1. Insert a component
2. Click Edit button
3. Click in a text input
4. Type several characters
5. Tab to next input
6. Type more text

**Expected**:
- ✅ First input maintains focus
- ✅ Can type without blur
- ✅ Tab moves to next field
- ✅ All inputs work normally

### Test 3: Property Persistence
**Steps**:
1. Insert a component
2. Click Edit button
3. Change a property value
4. Click "Apply Changes"
5. Component should update
6. Click Edit button again

**Expected**:
- ✅ Component shows updated value
- ✅ Quick-edit form shows saved value
- ✅ Changes persisted in editor
- ✅ Can edit again successfully

### Test 4: Component Rearrangement
**Steps**:
1. Insert two components
2. Edit properties on first component
3. Save changes
4. Drag first component below second
5. Edit second component

**Expected**:
- ✅ Drag and drop works
- ✅ Components reorder correctly
- ✅ First component retains its data
- ✅ Second component is editable

### Test 5: Component Deletion
**Steps**:
1. Insert a component
2. Edit properties
3. Save changes
4. Click Delete button

**Expected**:
- ✅ Component is removed
- ✅ Editor remains functional
- ✅ No errors in console
- ✅ Can insert new components

## Common Issues and Troubleshooting

### Issue: Component still gets deleted when typing
**Check**:
- Is `contenteditable="false"` on wrapper element?
- Is the wrapper element actually rendered?
- Are there any CSS overrides affecting pointer-events?

**Fix**:
```html
<div class="component-editor-wrapper" contenteditable="false">
```

### Issue: Forms still lose focus
**Check**:
- Is `onOverlayMouseDown` handler bound?
- Is `event.stopPropagation()` being called?
- Is the overlay inside the wrapper hierarchy?

**Fix**:
```html
<div class="quick-edit-overlay" 
     (mousedown)="onOverlayMouseDown($event)">
```

```typescript
onOverlayMouseDown(event: MouseEvent): void {
  event.stopPropagation(); // Must be present
}
```

### Issue: Changes don't persist
**Check**:
- Is `dispatch` parameter in command?
- Is `dispatch(tr)` being called?
- Is transaction being created with changes?

**Fix**:
```typescript
updateAngularComponent: (options) => 
  ({ tr, state, dispatch }) => { // Must include dispatch
    // ... make changes ...
    if (updated && dispatch) {
      dispatch(tr); // Must call dispatch
    }
    return updated;
  }
```

### Issue: Wrapper not updating
**Check**:
- Is `updateComponentData()` method defined?
- Is node view's `update()` method calling it?
- Is change detection running?

**Fix**:
```typescript
// In node view update:
const wrapperInstance = instance.componentRef.instance;
wrapperInstance.componentData = { 
  ...wrapperInstance.componentData, 
  ...newData 
};
instance.componentRef.changeDetectorRef.detectChanges();
```

## Performance Considerations

### Change Detection Optimization
- Only trigger change detection when data actually changes
- Use `OnPush` strategy where possible
- Avoid unnecessary wrapper re-renders

### Event Handler Efficiency
- Use `stopPropagation()` sparingly, only where needed
- Avoid deep event handler nesting
- Debounce rapid updates if necessary

### Transaction Batching
- Consider batching multiple updates into single transaction
- Avoid dispatching on every keystroke
- Use appropriate update granularity

## Future Improvements

### Potential Enhancements
1. **Undo/Redo Support**: Make component edits undoable
2. **Validation**: Add property validation before saving
3. **Conflict Resolution**: Handle concurrent edits gracefully
4. **Auto-save**: Automatically save changes after delay
5. **Change Indicators**: Show which properties changed

### Architecture Improvements
1. **State Management**: Consider using a state management library
2. **Event Bus**: Centralize component event handling
3. **Component Registry**: Better component lifecycle management
4. **Type Safety**: Stronger typing for component data

## Conclusion

The fixes implemented resolve both critical issues:
1. ✅ Components are protected from accidental deletion
2. ✅ Forms are fully functional with proper focus management
3. ✅ Property changes persist reliably
4. ✅ Bidirectional sync keeps everything consistent

The solution uses standard web APIs (`contenteditable`) and proper event handling to create a robust editing experience. All changes are backward compatible and follow Angular best practices.
