import { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { ResizableImage } from './resizable-image.extension';

function createEditor(content = '<p></p>'): Editor {
  return new Editor({
    extensions: [StarterKit, ResizableImage],
    content,
  });
}

function findImage(editor: Editor): { node: ProseMirrorNode; pos: number } {
  let found: { node: ProseMirrorNode; pos: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (!found && node.type.name === 'resizableImage') {
      found = { node, pos };
    }
    return !found;
  });
  if (!found) {
    throw new Error('no resizableImage node in the document');
  }
  return found;
}

/**
 * jsdom reports 0 for layout properties, so the handful of measurements the
 * resize handler reads have to be stubbed for the maths to be observable.
 */
function stubLayout(
  img: HTMLImageElement,
  size: { width: number; naturalWidth: number; naturalHeight: number }
) {
  Object.defineProperty(img, 'offsetWidth', {
    configurable: true,
    get: () => size.width,
  });
  Object.defineProperty(img, 'offsetHeight', {
    configurable: true,
    get: () =>
      Math.round(size.width * (size.naturalHeight / size.naturalWidth)),
  });
  Object.defineProperty(img, 'naturalWidth', {
    configurable: true,
    get: () => size.naturalWidth,
  });
  Object.defineProperty(img, 'naturalHeight', {
    configurable: true,
    get: () => size.naturalHeight,
  });
}

describe('ResizableImage extension', () => {
  let editor: Editor;

  afterEach(() => {
    editor?.destroy();
  });

  describe('attributes', () => {
    it('parses numeric width and height from the source HTML', () => {
      editor = createEditor(
        '<p><img src="/a.png" width="320" height="180" /></p>'
      );

      const { node } = findImage(editor);
      expect(node.attrs['width']).toBe(320);
      expect(node.attrs['height']).toBe(180);
    });

    it('leaves width and height null when the source omits them', () => {
      editor = createEditor('<p><img src="/a.png" /></p>');

      const { node } = findImage(editor);
      expect(node.attrs['width']).toBeNull();
      expect(node.attrs['height']).toBeNull();
    });

    it('renders dimensions back out only when they are set', () => {
      editor = createEditor(
        '<p><img src="/a.png" width="320" height="180" /></p>'
      );
      expect(editor.getHTML()).toContain('width="320"');
      expect(editor.getHTML()).toContain('height="180"');

      editor.commands.setContent('<p><img src="/a.png" /></p>');
      expect(editor.getHTML()).not.toContain('width=');
      expect(editor.getHTML()).not.toContain('height=');
    });

    it('keeps alt and title round-tripping through the document', () => {
      editor = createEditor(
        '<p><img src="/a.png" alt="Alt text" title="Title text" /></p>'
      );

      expect(editor.getHTML()).toContain('alt="Alt text"');
      expect(editor.getHTML()).toContain('title="Title text"');
    });
  });

  describe('setImage command', () => {
    it('inserts a resizableImage node carrying the supplied attributes', () => {
      editor = createEditor();

      const applied = editor.commands.setImage({
        src: '/b.png',
        alt: 'B',
        width: 240,
      });

      expect(applied).toBe(true);
      const { node } = findImage(editor);
      expect(node.type.name).toBe('resizableImage');
      expect(node.attrs['src']).toBe('/b.png');
      expect(node.attrs['alt']).toBe('B');
      expect(node.attrs['width']).toBe(240);
    });
  });

  describe('markdown input rule', () => {
    it('converts ![alt](src "title") into an image node', () => {
      editor = createEditor('<p>![Alt](/c.png "Caption"</p>');
      const end = editor.state.doc.content.size - 1;
      editor.commands.setTextSelection(end);

      editor.view.someProp('handleTextInput', (handler) =>
        handler(editor.view, end, end, ')', () =>
          editor.state.tr.insertText(')', end, end)
        )
      );

      const { node } = findImage(editor);
      expect(node.type.name).toBe('resizableImage');
      expect(node.attrs['src']).toBe('/c.png');
      expect(node.attrs['alt']).toBe('Alt');
      expect(node.attrs['title']).toBe('Caption');
    });
  });

  describe('node view', () => {
    it('builds a wrapper containing the image and a resize handle', () => {
      editor = createEditor(
        '<p><img src="/a.png" alt="A" title="T" width="320" height="180" /></p>'
      );

      const wrapper = editor.view.dom.querySelector(
        '.resizable-image-wrapper'
      ) as HTMLElement;
      const img = wrapper.querySelector('img') as HTMLImageElement;

      expect(img.getAttribute('src')).toBe('/a.png');
      expect(img.alt).toBe('A');
      expect(img.title).toBe('T');
      expect(img.style.width).toBe('320px');
      expect(img.style.height).toBe('180px');
      expect(wrapper.querySelector('.resize-handle')).not.toBeNull();
    });

    it('leaves the inline styles unset when the node has no dimensions', () => {
      editor = createEditor('<p><img src="/a.png" /></p>');

      const img = editor.view.dom.querySelector('img') as HTMLImageElement;
      expect(img.style.width).toBe('');
      expect(img.style.height).toBe('');
    });

    it('updates the existing image element in place when attributes change', () => {
      editor = createEditor('<p><img src="/a.png" width="320" /></p>');
      const before = editor.view.dom.querySelector('img') as HTMLImageElement;

      editor.commands.setNodeSelection(findImage(editor).pos);
      editor.commands.updateAttributes('resizableImage', {
        src: '/b.png',
        alt: 'B',
        title: 'TB',
        width: 400,
        height: 200,
      });

      const after = editor.view.dom.querySelector('img') as HTMLImageElement;
      expect(after).toBe(before);
      expect(after.getAttribute('src')).toBe('/b.png');
      expect(after.alt).toBe('B');
      expect(after.title).toBe('TB');
      expect(after.style.width).toBe('400px');
      expect(after.style.height).toBe('200px');
    });

    it('accepts string dimensions verbatim', () => {
      editor = createEditor('<p><img src="/a.png" /></p>');
      editor.commands.setNodeSelection(findImage(editor).pos);
      editor.commands.updateAttributes('resizableImage', {
        width: '50%',
        height: '10rem',
      });

      const img = editor.view.dom.querySelector('img') as HTMLImageElement;
      expect(img.style.width).toBe('50%');
      expect(img.style.height).toBe('10rem');
    });
  });

  describe('selection decoration', () => {
    it('marks the image wrapper as selected when the node is selected', () => {
      editor = createEditor('<p><img src="/a.png" /></p>');

      expect(
        editor.view.dom.querySelector('.resizable-image-selected')
      ).toBeNull();

      editor.commands.setNodeSelection(findImage(editor).pos);

      expect(
        editor.view.dom.querySelector('.resizable-image-selected')
      ).not.toBeNull();
    });
  });

  describe('resize handle', () => {
    let wrapper: HTMLElement;
    let img: HTMLImageElement;
    let handle: HTMLElement;

    beforeEach(() => {
      editor = createEditor('<p><img src="/a.png" width="100" /></p>');
      wrapper = editor.view.dom.querySelector(
        '.resizable-image-wrapper'
      ) as HTMLElement;
      img = wrapper.querySelector('img') as HTMLImageElement;
      handle = wrapper.querySelector('.resize-handle') as HTMLElement;
      stubLayout(img, { width: 100, naturalWidth: 200, naturalHeight: 100 });
    });

    function mouseDownOnHandle(clientX: number): MouseEvent {
      const event = new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX,
      });
      handle.dispatchEvent(event);
      return event;
    }

    it('resizes the image while dragging, preserving the aspect ratio', () => {
      const event = mouseDownOnHandle(10);
      expect(event.defaultPrevented).toBe(true);

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 60 }));

      expect(img.style.width).toBe('150px');
      expect(img.style.height).toBe('75px');

      // Release the drag: the handler attaches document listeners on mousedown
      // and only detaches them on mouseup, so leaving it held would let this
      // test's listeners fire against the next test's destroyed editor.
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 60 }));
    });

    it('clamps the dragged width to a 50px minimum', () => {
      mouseDownOnHandle(500);

      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 0 }));

      expect(img.style.width).toBe('50px');

      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 0 }));
    });

    it('writes the measured size back onto the node and detaches the listeners on mouseup', () => {
      mouseDownOnHandle(10);
      stubLayout(img, { width: 180, naturalWidth: 200, naturalHeight: 100 });

      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 90 }));

      const { node } = findImage(editor);
      expect(node.attrs['width']).toBe(180);
      expect(node.attrs['height']).toBe(90);

      const widthAfterMouseUp = img.style.width;
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 900 }));
      expect(img.style.width).toBe(widthAfterMouseUp);
    });
  });
});
