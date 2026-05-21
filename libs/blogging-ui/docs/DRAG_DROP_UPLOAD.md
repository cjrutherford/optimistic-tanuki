# Drag-and-Drop Image Upload - Implementation Guide

## Overview
All TipTap editor components now support drag-and-drop image uploads with automatic upload to the Assets service. This provides a seamless user experience for adding images to blog posts, social posts, forum posts, and comments.

## Components with Drag-and-Drop

### 1. Blog Compose Component
**Location**: `libs/blogging-ui/src/lib/blog-compose/blog-compose.component.ts`

**Features**:
- ✅ Drag-and-drop enabled
- ✅ Uploads to Assets service
- ✅ Automatic image sizing (95% of editor width)
- ✅ Multiple file support
- ✅ Image file filtering
- ✅ ProfileId validation
- ✅ Error handling

**Event Handlers**:
- `handleDragEnter()` - Shows drag overlay
- `handleDragOver()` - Maintains drag state
- `handleDragLeave()` - Hides drag overlay
- `handleDrop()` - Processes dropped files

### 2. Social Compose Component
**Location**: `libs/social-ui/src/lib/social-ui/compose/compose.component.ts`

**Features**:
- ✅ Drag-and-drop enabled
- ✅ Uploads to Assets service
- ✅ Multiple file support
- ✅ Backward compatible with custom callback
- ✅ Image file filtering
- ✅ ProfileId validation
- ✅ Error handling

**Dual Mode Support**:
Supports both custom upload callbacks (for legacy) and Assets service (default).

### 3. Forum Compose Component
**Location**: `libs/forum-ui/src/lib/forum-ui/compose-forum-post/compose-forum-post.component.ts`

**Features** (NEW):
- ✅ Drag-and-drop enabled
- ✅ Uploads to Assets service
- ✅ Visual feedback overlay
- ✅ Multiple file support
- ✅ Image file filtering
- ✅ ProfileId validation
- ✅ Error handling

**Visual States**:
- Normal: Standard editor appearance
- Dragging: Blue border highlight
- Drag Over: "Drop images here" overlay

## Technical Implementation

### Drag Event Flow

```
User drags file over editor
       ↓
handleDragEnter() / handleDragOver()
       ↓
Check if files (not internal drag)
       ↓
Set isDragOver = true
       ↓
Apply .dragover CSS class
       ↓
User drops file
       ↓
handleDrop()
       ↓
Validate profileId exists
       ↓
Filter for image files only
       ↓
For each image file:
  ↓
  Upload to Assets service
  ↓
  Get asset URL
  ↓
  Insert into editor
       ↓
Set isDragOver = false
```

### Code Pattern

All components follow this pattern:

```typescript
async handleDrop(e: DragEvent): Promise<void> {
  e.preventDefault();
  this.isDragOver = false;

  // Validate files exist
  if (!e.dataTransfer?.files.length) return;

  // Validate profileId
  if (!this.profileId) {
    alert('Unable to upload image: User profile not found');
    return;
  }

  // Filter for images only
  const files = Array.from(e.dataTransfer.files);
  const imageFiles = files.filter(file => file.type.startsWith('image/'));
  
  if (imageFiles.length === 0) {
    alert('Please drop image files only');
    return;
  }

  // Upload each image
  for (const file of imageFiles) {
    try {
      const assetUrl = await this.imageUploadService.uploadFile(
        file,
        this.profileId,
        `component-drag-drop-${Date.now()}`
      );
      
      this.editor.chain().focus().setImage({ src: assetUrl }).run();
    } catch (error) {
      console.error('Error uploading dropped file:', error);
      alert(`Failed to upload ${file.name}. Please try again.`);
    }
  }
}
```

### HTML Template Pattern

```html
<div class="editor-container"
     [class.dragover]="isDragOver"
     (dragenter)="handleDragEnter($event)"
     (dragover)="handleDragOver($event)"
     (dragleave)="handleDragLeave($event)"
     (drop)="handleDrop($event)">
  <tiptap-editor [editor]="editor"></tiptap-editor>
</div>
```

### CSS Styling Pattern

```scss
.editor-container {
  position: relative;
  transition: border-color 0.2s ease;
  border: 1px solid var(--border-color);

  &.dragover {
    border-color: var(--accent-color);
    border-width: 2px;
    background-color: rgba(0, 122, 204, 0.05);

    &::after {
      content: 'Drop images here';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 1rem 2rem;
      background: var(--accent-color);
      color: white;
      border-radius: 8px;
      font-weight: bold;
      pointer-events: none;
      z-index: 10;
    }
  }
}
```

## Features Detailed

### 1. Image File Filtering

Only image files are accepted:

```typescript
const imageFiles = files.filter(file => file.type.startsWith('image/'));

if (imageFiles.length === 0) {
  alert('Please drop image files only');
  return;
}
```

**Supported Types**:
- image/png
- image/jpeg
- image/jpg
- image/gif
- image/webp
- image/svg+xml

**Rejected**:
- Documents (PDF, Word, etc.)
- Videos
- Audio files
- Other non-image files

### 2. ProfileId Validation

All uploads require a valid profileId:

```typescript
if (!this.profileId) {
  console.error('Profile ID is required for image upload');
  alert('Unable to upload image: User profile not found');
  return;
}
```

**Error Scenarios**:
- User not authenticated
- Profile not loaded
- ProfileId not passed to component

### 3. Multiple File Support

Users can drop multiple images at once:

```typescript
for (const file of imageFiles) {
  try {
    const assetUrl = await this.imageUploadService.uploadFile(...);
    this.editor.chain().focus().setImage({ src: assetUrl }).run();
  } catch (error) {
    alert(`Failed to upload ${file.name}. Please try again.`);
  }
}
```

**Behavior**:
- Each file uploaded sequentially
- Each file inserted as separate image
- Errors reported per file (doesn't stop other uploads)
- Successful uploads inserted even if one fails

### 4. Error Handling

Comprehensive error handling at multiple levels:

**Missing ProfileId**:
```
Alert: "Unable to upload image: User profile not found"
Console: "Profile ID is required for image upload"
```

**No Image Files**:
```
Alert: "Please drop image files only"
```

**Upload Failure**:
```
Alert: "Failed to upload {filename}. Please try again."
Console: Full error details
```

### 5. Visual Feedback

**Blog & Social Compose**:
- `isDragOver` property toggles
- Can add custom styling

**Forum Compose**:
- Border highlights blue
- Background tint applied
- "Drop images here" overlay appears
- Smooth transitions

### 6. Automatic Sizing (Blog Compose Only)

Blog compose applies automatic width:

```typescript
const editorElement = this.editor.view.dom;
const editorWidth = editorElement.clientWidth;
const defaultWidth = Math.floor(editorWidth * 0.95);

this.editor.chain().focus().setImage({
  src: assetUrl,
  width: `${defaultWidth}px`,
}).run();
```

**Benefit**: Images fit editor width automatically, maintaining responsive design.

## User Experience

### Drag-and-Drop Flow

1. **User drags image file from desktop/folder**
   - Cursor shows drag indicator

2. **User hovers over editor**
   - Border highlights (forum)
   - Overlay appears (forum)
   - Visual feedback confirms drop zone

3. **User releases file**
   - Overlay disappears
   - Upload begins (background)
   - Image appears in editor when ready

4. **Success**
   - Image inserted at cursor position
   - Asset URL used (not base64)
   - Can continue editing

5. **Error (if any)**
   - Alert shown with specific error
   - Editor remains usable
   - User can retry

### Best Practices for Users

**DO**:
✅ Drop image files (PNG, JPG, GIF, WebP)
✅ Drop multiple images at once
✅ Wait for upload to complete
✅ Ensure you're logged in

**DON'T**:
❌ Drop non-image files
❌ Drop very large files (>10MB recommended)
❌ Drop while not authenticated

## Integration Guide

### For Parent Components

Parent components must provide `profileId`:

```typescript
// Example: Blog page component
export class BlogPageComponent {
  profileService = inject(ProfileService);
  
  get currentProfileId(): string | undefined {
    return this.profileService.getCurrentUserProfile()?.id;
  }
}
```

```html
<!-- Template -->
<lib-blog-compose 
  [profileId]="currentProfileId"
  [(ngModel)]="postData">
</lib-blog-compose>
```

### For New Components

To add drag-and-drop to a new editor component:

1. **Add property**:
```typescript
isDragOver = false;
```

2. **Inject service**:
```typescript
private imageUploadService = inject(ImageUploadService);
```

3. **Add Input**:
```typescript
@Input() profileId?: string;
```

4. **Add event handlers**:
```typescript
handleDragEnter(e: DragEvent): void { ... }
handleDragOver(e: DragEvent): void { ... }
handleDragLeave(e: DragEvent): void { ... }
async handleDrop(e: DragEvent): Promise<void> { ... }
```

5. **Update template**:
```html
<div (dragenter)="handleDragEnter($event)"
     (dragover)="handleDragOver($event)"
     (dragleave)="handleDragLeave($event)"
     (drop)="handleDrop($event)"
     [class.dragover]="isDragOver">
  <tiptap-editor [editor]="editor"></tiptap-editor>
</div>
```

6. **Add styles**:
```scss
.dragover {
  // Visual feedback styles
}
```

## Testing

### Manual Testing Checklist

- [ ] Drop single image file
- [ ] Drop multiple image files
- [ ] Drop non-image file (should reject)
- [ ] Drop mixed files (should filter to images)
- [ ] Drop without profileId (should error)
- [ ] Drop with network failure (should error gracefully)
- [ ] Drop very large image (should handle appropriately)
- [ ] Drop in different browsers (Chrome, Firefox, Safari)
- [ ] Drop on mobile (if applicable)

### Automated Testing

Example test:

```typescript
it('should upload dropped images to Assets service', async () => {
  const mockFile = new File(['image'], 'test.png', { type: 'image/png' });
  const mockAssetUrl = '/asset/123';
  
  spyOn(imageUploadService, 'uploadFile').and.returnValue(
    Promise.resolve(mockAssetUrl)
  );
  
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(mockFile);
  
  const dropEvent = new DragEvent('drop', { dataTransfer });
  await component.handleDrop(dropEvent);
  
  expect(imageUploadService.uploadFile).toHaveBeenCalledWith(
    mockFile,
    component.profileId,
    jasmine.any(String)
  );
  
  expect(mockEditor.chain().focus().setImage).toHaveBeenCalledWith({
    src: mockAssetUrl
  });
});
```

## Troubleshooting

### Issue: Drag-and-drop not working

**Possible Causes**:
1. Event handlers not bound in template
2. `isDragOver` property not defined
3. CSS preventing pointer events
4. Browser security restrictions

**Solutions**:
- Verify event handlers in HTML
- Check browser console for errors
- Test in different browser
- Ensure component properly initialized

### Issue: Images not uploading

**Possible Causes**:
1. Missing profileId
2. Network issues
3. Assets service down
4. File too large

**Solutions**:
- Check profileId is passed to component
- Verify network connectivity
- Check browser console for errors
- Review Assets service logs

### Issue: Non-image files accepted

**Possible Causes**:
1. File filter not applied
2. MIME type detection failing

**Solutions**:
- Verify image filter code present
- Check file.type property
- Add additional validation

## Performance Considerations

### Upload Performance

**Sequential Uploads**:
- Files uploaded one at a time
- Prevents overwhelming server
- Better error handling

**Parallel Option** (future):
Could implement parallel uploads:
```typescript
await Promise.all(
  imageFiles.map(file => 
    this.imageUploadService.uploadFile(file, profileId)
  )
);
```

### Large Files

**Current**: No client-side size limit

**Recommendation**: Add size check:
```typescript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

if (file.size > MAX_FILE_SIZE) {
  alert(`File ${file.name} is too large. Max size: 10MB`);
  continue;
}
```

## Security

### File Validation

**Client-side** (basic):
- MIME type check
- File extension check (implicit)

**Server-side** (comprehensive):
- MIME type verification
- Magic number check
- Virus scanning
- Size limits
- Access control

### Best Practices

✅ Always validate on server
✅ Never trust client MIME type
✅ Scan for malware
✅ Limit file sizes
✅ Authenticate uploads
✅ Rate limit uploads

## Future Enhancements

### Possible Improvements

1. **Upload Progress**
   - Show progress bar during upload
   - Cancel upload option

2. **Image Preview**
   - Show thumbnail while uploading
   - Preview before final insert

3. **Batch Upload**
   - Single progress indicator for multiple files
   - Retry failed uploads

4. **Paste Support**
   - Handle Ctrl+V with image in clipboard
   - Same upload flow

5. **Advanced Filtering**
   - File size preview before upload
   - Image dimension preview
   - Format conversion options

6. **Optimization**
   - Client-side image compression
   - Resize before upload
   - WebP conversion

## Conclusion

Drag-and-drop image upload provides a modern, intuitive way for users to add images to their content. By uploading to the Assets service, we ensure:

✅ Consistent upload behavior across all methods
✅ Security through centralized validation
✅ Performance via optimized asset delivery
✅ Better user experience with visual feedback

All TipTap editors now support this feature with proper error handling and validation.
