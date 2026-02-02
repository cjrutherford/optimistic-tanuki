import { Node, mergeAttributes, CommandProps } from '@tiptap/core';
import { EditorState, Transaction } from '@tiptap/pm/state';
import { ViewContainerRef } from '@angular/core';
import {
  InjectableComponent,
  InjectedComponentInstance,
} from '../interfaces/component-injection.interface';

export interface AngularComponentOptions {
  HTMLAttributes: Record<string, unknown>;
  viewContainerRef?: ViewContainerRef;
  onComponentClick?: (componentId: string, instanceId: string) => void;
  onComponentDelete?: (instanceId: string) => void;
  onComponentEdit?: (instanceId: string) => void;
  renderer?: (
    componentId: string,
    instanceId: string,
    data: Record<string, unknown>,
    element: HTMLElement
  ) => InjectedComponentInstance;
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
      renderer: undefined,
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

  renderHTML({
    HTMLAttributes,
  }: {
    HTMLAttributes: Record<string, any>;
  }): [string, Record<string, any>, ...any[]] {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-angular-component': '',
        class: 'angular-component-node',
      }),
      [
        'div',
        { class: 'component-placeholder' },
        'Angular Component Loading...',
      ],
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.classList.add('angular-component-node');

      const componentId = node.attrs['componentId'];
      const instanceId = node.attrs['instanceId'];
      const data = node.attrs['data'];

      let instance: InjectedComponentInstance | undefined;

      if (this.options.renderer) {
        instance = this.options.renderer(componentId, instanceId, data, dom);
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== this.name) {
            return false;
          }

          const newData = updatedNode.attrs['data'];
          if (
            instance &&
            instance.componentRef &&
            instance.componentRef.instance
          ) {
            Object.assign(instance.componentRef.instance, newData);
            // Also update the instance data
            instance.data = { ...instance.data, ...newData };

            if (instance.componentRef.changeDetectorRef) {
              instance.componentRef.changeDetectorRef.detectChanges();
            }
          }
          return true;
        },
        destroy: () => {
          if (instance && instance.componentRef) {
            instance.componentRef.destroy();
          }
        },
      };
    };
  },

  addCommands(): Record<string, any> {
    return {
      insertAngularComponent:
        (options: {
          componentId: string;
          instanceId: string;
          data?: Record<string, any>;
          componentDef: InjectableComponent;
        }) =>
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
              if (
                node.type.name === this.name &&
                node.attrs['instanceId'] === options.instanceId
              ) {
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
              if (
                node.type.name === this.name &&
                node.attrs['instanceId'] === instanceId
              ) {
                tr.delete(pos, pos + node.nodeSize);
                removed = true;
              }
            });

            return removed;
          },
    };
  },


});

export default AngularComponentNode;
