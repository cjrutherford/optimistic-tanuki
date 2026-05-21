# Image Resize Feature Documentation

## Overview
The TipTap editor now supports resizable images with drag-to-resize functionality and automatic default sizing.

## Features

### 1. Default Image Width
When an image is inserted into the editor:
- The editor's content area width is measured
- The image is set to 95% of that width
- Height is calculated automatically to maintain aspect ratio
- This prevents images from overflowing the editor

### 2. Drag-to-Resize
Users can resize images by:
1. Hovering over an image to reveal the resize handle (blue square in bottom-right corner)
2. Clicking and dragging the handle left/right
3. The image resizes in real-time while maintaining aspect ratio
4. Releasing the mouse to save the new size

### 3. Visual Feedback
- **Normal state**: Image displays with no border
- **Hover state**: Resize handle becomes visible
- **Selected state**: Image shows blue outline, handle always visible
- **Resizing**: Cursor changes to SE-resize, image updates in real-time

## Technical Implementation

### ResizableImage Extension
Custom TipTap node extension that:
- Extends the base image functionality
- Adds `width` and `height` attributes
- Renders images in a wrapper div with resize handle
- Implements mouse event handlers for drag-to-resize
- Updates node attributes after resize

### Key Files
1. `resizable-image.extension.ts` - Custom TipTap extension
2. `blog-compose.component.ts` - Integration and image insertion logic
3. `blog-compose.component.scss` - Styles for wrapper, handles, and states

### CSS Classes
- `.resizable-image-wrapper` - Container for image and handle
- `.resize-handle` - The draggable resize control
- `.resizable-image-selected` - Applied when image is selected

## Usage

### Inserting an Image
1. Click the image upload button in the toolbar
2. Select an image file
3. Image is inserted at 95% of editor width
4. Height is automatically calculated

### Resizing an Image
1. Click on the image to select it
2. Hover over bottom-right corner to see resize handle
3. Click and drag the handle to resize
4. Release to save the new size

### Constraints
- Minimum width: 50px
- Maximum width: 100% of editor width
- Aspect ratio: Always maintained
- Images are responsive and constrain to parent width

## Browser Compatibility
Works in all modern browsers that support:
- CSS transitions
- Mouse events (mousedown, mousemove, mouseup)
- Flexbox layout
- CSS custom properties (for theming)

## Future Enhancements
Potential improvements:
- Corner handles for proportional resize from any corner
- Edge handles for width/height-only resize
- Numeric input for precise dimensions
- Keyboard shortcuts for resize increments
- Alignment controls (left, center, right)
- Caption support below images
