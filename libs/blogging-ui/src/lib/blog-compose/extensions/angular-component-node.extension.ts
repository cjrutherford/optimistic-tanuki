import { Node, mergeAttributes } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin } from '@tiptap/pm/state';
import { ComponentRef, ViewContainerRef, Type } from '@angular/core';
import { InjectableComponent } from '../interfaces/component-injection.interface';

export interface AngularComponentOptions {
  HTMLAttributes: Record<string, any>;
  viewContainerRef?: ViewContainerRef;
  onComponentClick?: (componentId: string, instanceId: string) => void;
  onComponentDelete?: (instanceId: string) => void;
  onComponentEdit?: (instanceId: string) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    angularComponent: {
      /**
       * Insert an Angular component into the editor
       */
      insertAngularComponent: (options: {
        componentId: string;
        instanceId: string;
        data?: any;
        componentDef: InjectableComponent;
      }) => ReturnType;
      /**
       * Update an existing Angular component
       */
      updateAngularComponent: (options: {
        instanceId: string;
        data: any;
      }) => ReturnType;
      /**
       * Remove an Angular component
       */
      removeAngularComponent: (instanceId: string) => ReturnType;
    };
  }
}

export const AngularComponentNode = Node.create<AngularComponentOptions>({
  name: 'angularComponent',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      viewContainerRef: undefined,
      onComponentClick: undefined,
      onComponentDelete: undefined,
      onComponentEdit: undefined,
    };
  },

  addAttributes() {
    return {
      componentId: {
        default: null,
      },
      instanceId: {
        default: null,
      },
      data: {
        default: {},
      },
      componentDef: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-angular-component]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-angular-component': '',
        'class': 'angular-component-node',
      }),
      ['div', { class: 'component-placeholder' }, 'Angular Component Loading...'],
    ];
  },

  addCommands() {
    return {
      insertAngularComponent:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              componentId: options.componentId,
              instanceId: options.instanceId,
              data: options.data,
              componentDef: options.componentDef,
            },
          });
        },

      updateAngularComponent:
        (options) =>
        ({ tr, state }) => {
          const { doc } = state;
          let updated = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.instanceId === options.instanceId) {
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                data: options.data,
              });
              updated = true;
            }
          });

          return updated;
        },

      removeAngularComponent:
        (instanceId) =>
        ({ tr, state }) => {
          const { doc } = state;
          let removed = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs.instanceId === instanceId) {
              tr.delete(pos, pos + node.nodeSize);
              removed = true;
            }
          });

          return removed;
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    
    return [
      new Plugin({
        key: new PluginKey('angularComponentRenderer'),
        props: {
          decorations: (state) => {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                const decoration = Decoration.widget(pos, () => {
                  const container = document.createElement('div');
                  container.className = 'angular-component-container';
                  container.setAttribute('data-instance-id', node.attrs.instanceId);
                  
                  // Add component controls
                  const controls = document.createElement('div');
                  controls.className = 'component-controls';
                  controls.innerHTML = `
                    <button class="component-edit-btn" title="Edit Component">✏️</button>
                    <button class="component-delete-btn" title="Delete Component">🗑️</button>
                    <span class="component-label">${node.attrs.componentDef?.name || 'Component'}</span>
                  `;
                  
                  // Add event listeners
                  const editBtn = controls.querySelector('.component-edit-btn');
                  const deleteBtn = controls.querySelector('.component-delete-btn');
                  
                  editBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.onComponentEdit?.(node.attrs.instanceId);
                  });
                  
                  deleteBtn?.addEventListener('click', (e) => {
                    e.stopPropagation();
                    options.onComponentDelete?.(node.attrs.instanceId);
                  });
                  
                  container.appendChild(controls);
                  
                  // Add component content placeholder
                  const content = document.createElement('div');
                  content.className = 'component-content';
                  content.innerHTML = `
                    <div class="component-preview">
                      <h4>${node.attrs.componentDef?.name || 'Angular Component'}</h4>
                      <p>${node.attrs.componentDef?.description || 'Click to edit this component'}</p>
                    </div>
                  `;
                  
                  container.appendChild(content);
                  
                  // Make the container clickable
                  container.addEventListener('click', () => {
                    options.onComponentClick?.(node.attrs.componentId, node.attrs.instanceId);
                  });
                  
                  return container;
                });
                
                decorations.push(decoration);
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

export default AngularComponentNode;