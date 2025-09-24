import { Node, mergeAttributes, CommandProps } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, EditorState, Transaction } from '@tiptap/pm/state';
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
        data?: Record<string, any>;
        componentDef: InjectableComponent;
      }) => ReturnType;
      /**
       * Update an existing Angular component
       */
      updateAngularComponent: (options: {
        instanceId: string;
        data: Record<string, any>;
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

  addOptions(): AngularComponentOptions {
    return {
      HTMLAttributes: {},
      viewContainerRef: undefined,
      onComponentClick: undefined,
      onComponentDelete: undefined,
      onComponentEdit: undefined,
    };
  },

  addAttributes(): Record<string, any> {
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

  parseHTML(): { tag: string }[] {
    return [
      {
        tag: 'div[data-angular-component]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, any> }): [string, Record<string, any>, ...any[]] {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-angular-component': '',
        'class': 'angular-component-node',
      }),
      ['div', { class: 'component-placeholder' }, 'Angular Component Loading...'],
    ];
  },

  addCommands(): Record<string, any> {
    return {
      insertAngularComponent:
        (options: { componentId: string; instanceId: string; data?: Record<string, any>; componentDef: InjectableComponent }) =>
        ({ commands }: CommandProps) => {
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
        (options: { instanceId: string; data: Record<string, any> }) =>
        ({ tr, state }: { tr: Transaction; state: EditorState }) => {
          const { doc } = state;
          let updated = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs['instanceId'] === options.instanceId) {
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
        (instanceId: string) =>
        ({ tr, state }: { tr: Transaction; state: EditorState }) => {
          const { doc } = state;
          let removed = false;

          doc.descendants((node, pos) => {
            if (node.type.name === this.name && node.attrs['instanceId'] === instanceId) {
              tr.delete(pos, pos + node.nodeSize);
              removed = true;
            }
          });

          return removed;
        },
    };
  },

  addProseMirrorPlugins(): Plugin[] {
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey('angularComponentRenderer'),
        props: {
          decorations: (state: EditorState): DecorationSet => {
            const decorations: Decoration[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                const decoration = Decoration.widget(pos, () => {
                  const container = document.createElement('div');
                  container.className = 'angular-component-container';
                  container.setAttribute('data-instance-id', node.attrs['instanceId']);

                  // Add component controls
                  const controls = document.createElement('div');
                  controls.className = 'component-controls';
                  controls.innerHTML = `
                    <button class="component-edit-btn" title="Edit Component">✏️</button>
                    <button class="component-delete-btn" title="Delete Component">🗑️</button>
                    <span class="component-label">${node.attrs['componentDef']?.name || 'Component'}</span>
                  `;

                  // Add event listeners
                  const editBtn = controls.querySelector('.component-edit-btn');
                  const deleteBtn = controls.querySelector('.component-delete-btn');

                  if (editBtn) {
                    editBtn.addEventListener('click', (e: Event) => {
                      e.stopPropagation();
                      if (options.onComponentEdit) {
                        options.onComponentEdit(node.attrs['instanceId']);
                      }
                    });
                  }

                  if (deleteBtn) {
                    deleteBtn.addEventListener('click', (e: Event) => {
                      e.stopPropagation();
                      if (options.onComponentDelete) {
                        options.onComponentDelete(node.attrs['instanceId']);
                      }
                    });
                  }

                  container.appendChild(controls);

                  // Add component content placeholder
                  const content = document.createElement('div');
                  content.className = 'component-content';
                  content.innerHTML = `
                    <div class="component-preview">
                      <h4>${node.attrs['componentDef']?.name || 'Angular Component'}</h4>
                      <p>${node.attrs['componentDef']?.description || 'Click to edit this component'}</p>
                    </div>
                  `;

                  container.appendChild(content);

                  // Make the container clickable
                  container.addEventListener('click', () => {
                    if (options.onComponentClick) {
                      options.onComponentClick(node.attrs['componentId'], node.attrs['instanceId']);
                    }
                  });

                  return container;
                });

                if (decoration) {
                  decorations.push(decoration);
                }
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