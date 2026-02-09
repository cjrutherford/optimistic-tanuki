import { Node, mergeAttributes, nodeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface ResizableImageOptions {
  inline: boolean;
  allowBase64: boolean;
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    resizableImage: {
      /**
       * Add an image with optional width
       */
      setImage: (options: {
        src: string;
        alt?: string;
        title?: string;
        width?: string | number;
      }) => ReturnType;
    };
  }
}

export const ResizableImage = Node.create<ResizableImageOptions>({
  name: 'resizableImage',

  addOptions() {
    return {
      inline: false,
      allowBase64: true,
      HTMLAttributes: {},
    };
  },

  inline() {
    return this.options.inline;
  },

  group() {
    return this.options.inline ? 'inline' : 'block';
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const width = element.getAttribute('width');
          return width ? parseInt(width, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes['width']) {
            return {};
          }
          return {
            width: attributes['width'],
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const height = element.getAttribute('height');
          return height ? parseInt(height, 10) : null;
        },
        renderHTML: (attributes) => {
          if (!attributes['height']) {
            return {};
          }
          return {
            height: attributes['height'],
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: this.options.allowBase64
          ? 'img[src]'
          : 'img[src]:not([src^="data:"])',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
    ];
  },

  addCommands() {
    return {
      setImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: /!\[(.+|:?)]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match;

          return { src, alt, title };
        },
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('resizableImage'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const { doc, selection } = state;

            doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                const selected =
                  selection.from === pos ||
                  (selection.from <= pos &&
                    selection.to >= pos + node.nodeSize);

                if (selected) {
                  decorations.push(
                    Decoration.node(pos, pos + node.nodeSize, {
                      class: 'resizable-image-selected',
                    })
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleDOMEvents: {
            mousedown: (view, event) => {
              const target = event.target as HTMLElement;

              if (target.classList.contains('resize-handle')) {
                event.preventDefault();
                const img = target
                  .closest('.resizable-image-wrapper')
                  ?.querySelector('img') as HTMLImageElement;

                if (!img) return false;

                const startX = event.clientX;
                const startWidth = img.offsetWidth;
                const aspectRatio = img.naturalHeight / img.naturalWidth;

                const onMouseMove = (e: MouseEvent) => {
                  const deltaX = e.clientX - startX;
                  const newWidth = Math.max(50, startWidth + deltaX);
                  const newHeight = newWidth * aspectRatio;

                  img.style.width = `${newWidth}px`;
                  img.style.height = `${newHeight}px`;
                };

                const onMouseUp = (e: MouseEvent) => {
                  document.removeEventListener('mousemove', onMouseMove);
                  document.removeEventListener('mouseup', onMouseUp);

                  const wrapper = target.closest(
                    '.resizable-image-wrapper'
                  ) as HTMLElement;
                  if (wrapper) {
                    const pos = view.posAtDOM(wrapper, 0);
                    if (pos !== null && pos >= 0) {
                      const node = view.state.doc.nodeAt(pos);
                      if (node && node.type.name === 'resizableImage') {
                        const newWidth = img.offsetWidth;
                        const newHeight = img.offsetHeight;

                        view.dispatch(
                          view.state.tr.setNodeMarkup(pos, undefined, {
                            ...node.attrs,
                            width: newWidth,
                            height: newHeight,
                          })
                        );
                      }
                    }
                  }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);

                return true;
              }

              return false;
            },
          },
        },
      }),
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.classList.add('resizable-image-wrapper');

      const img = document.createElement('img');
      img.src = node.attrs['src'];
      if (node.attrs['alt']) img.alt = node.attrs['alt'];
      if (node.attrs['title']) img.title = node.attrs['title'];
      if (node.attrs['width'])
        img.style.width =
          typeof node.attrs['width'] === 'number'
            ? `${node.attrs['width']}px`
            : node.attrs['width'];
      if (node.attrs['height'])
        img.style.height =
          typeof node.attrs['height'] === 'number'
            ? `${node.attrs['height']}px`
            : node.attrs['height'];

      dom.appendChild(img);

      const resizeHandle = document.createElement('div');
      resizeHandle.classList.add('resize-handle');
      resizeHandle.contentEditable = 'false';
      dom.appendChild(resizeHandle);

      return {
        dom,
        contentDOM: null,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false;
          }

          img.src = updatedNode.attrs['src'];
          if (updatedNode.attrs['alt']) img.alt = updatedNode.attrs['alt'];
          if (updatedNode.attrs['title'])
            img.title = updatedNode.attrs['title'];
          if (updatedNode.attrs['width'])
            img.style.width =
              typeof updatedNode.attrs['width'] === 'number'
                ? `${updatedNode.attrs['width']}px`
                : updatedNode.attrs['width'];
          if (updatedNode.attrs['height'])
            img.style.height =
              typeof updatedNode.attrs['height'] === 'number'
                ? `${updatedNode.attrs['height']}px`
                : updatedNode.attrs['height'];

          return true;
        },
      };
    };
  },
});
