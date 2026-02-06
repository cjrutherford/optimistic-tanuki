/**
 * ComponentInjectionExtension - Simplified TipTap extension for injecting components
 * 
 * FIRST Principles:
 * - Fast: Minimal overhead, simple data structure
 * - Independent: Self-contained, no external service dependencies
 * - Repeatable: Reusable across blogging-ui and social-ui
 * - Self-validating: Built-in data validation
 * - Timely: Clear event flow for component changes
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, EditorState } from '@tiptap/pm/state';

export interface InjectedComponentData {
  instanceId: string;
  componentType: string;
  componentData: Record<string, any>;
  position?: number;
}

export interface ComponentInjectionOptions {
  HTMLAttributes: Record<string, any>;
  /**
   * Callback when components change (add/update/delete)
   */
  onComponentsChanged?: (components: InjectedComponentData[]) => void;
  /**
   * Callback when a component is clicked
   */
  onComponentClick?: (instanceId: string) => void;
  /**
   * Callback when component needs editing
   */
  onComponentEdit?: (instanceId: string, data: Record<string, any>) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    componentInjection: {
      /**
       * Insert a component into the editor
       */
      insertComponent: (options: {
        instanceId: string;
        componentType: string;
        data: Record<string, any>;
      }) => ReturnType;
      /**
       * Update component data
       */
      updateComponent: (options: {
        instanceId: string;
        data: Record<string, any>;
      }) => ReturnType;
      /**
       * Remove a component
       */
      removeComponent: (instanceId: string) => ReturnType;
      /**
       * Get all injected components
       */
      getInjectedComponents: () => InjectedComponentData[];
    };
  }
}

const pluginKey = new PluginKey('componentInjection');

export const ComponentInjection = Node.create<ComponentInjectionOptions>({
  name: 'injectedComponent',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      onComponentsChanged: undefined,
      onComponentClick: undefined,
      onComponentEdit: undefined,
    };
  },

  addAttributes() {
    return {
      instanceId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-instance-id'),
        renderHTML: (attributes) => {
          if (!attributes.instanceId) return {};
          return { 'data-instance-id': attributes.instanceId };
        },
      },
      componentType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-component-type'),
        renderHTML: (attributes) => {
          if (!attributes.componentType) return {};
          return { 'data-component-type': attributes.componentType };
        },
      },
      data: {
        default: {},
        parseHTML: (element) => {
          const dataStr = element.getAttribute('data-component-data');
          try {
            return dataStr ? JSON.parse(dataStr) : {};
          } catch (e) {
            console.error('Failed to parse component data:', e);
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (!attributes.data || Object.keys(attributes.data).length === 0) {
            return {};
          }
          return { 'data-component-data': JSON.stringify(attributes.data) };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-injected-component]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-injected-component': '',
        class: 'injected-component-node',
      }),
      [
        'div',
        { class: 'component-placeholder' },
        `Component: ${node.attrs.componentType || 'Unknown'} (${node.attrs.instanceId || 'no-id'
        })`,
      ],
    ];
  },

  addCommands() {
    return {
      insertComponent:
        (options) =>
          ({ commands }) => {
            return commands.insertContent({
              type: this.name,
              attrs: {
                instanceId: options.instanceId,
                componentType: options.componentType,
                data: options.data,
              },
            });
          },

      updateComponent:
        (options) =>
          ({ tr, state, dispatch }) => {
            const { doc } = state;
            let updated = false;

            doc.descendants((node, pos) => {
              if (
                node.type.name === this.name &&
                node.attrs.instanceId === options.instanceId
              ) {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  data: { ...node.attrs.data, ...options.data },
                });
                updated = true;
              }
            });

            if (updated && dispatch) {
              dispatch(tr);
            }

            return updated;
          },

      removeComponent:
        (instanceId) =>
          ({ tr, state, dispatch }) => {
            const { doc } = state;
            let removed = false;

            doc.descendants((node, pos) => {
              if (
                node.type.name === this.name &&
                node.attrs.instanceId === instanceId
              ) {
                tr.delete(pos, pos + node.nodeSize);
                removed = true;
              }
            });

            if (removed && dispatch) {
              dispatch(tr);
            }

            return removed;
          },

      getInjectedComponents:
        () =>
          ({ state }) => {
            const components: InjectedComponentData[] = [];
            const { doc } = state;

            doc.descendants((node, pos) => {
              if (node.type.name === this.name) {
                components.push({
                  instanceId: node.attrs.instanceId,
                  componentType: node.attrs.componentType,
                  componentData: node.attrs.data,
                  position: pos,
                });
              }
            });

            return components;
          },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: pluginKey,
        state: {
          init() {
            return { components: [] as InjectedComponentData[] };
          },
          apply(tr, value, oldState, newState) {
            // Extract components from new state
            const components: InjectedComponentData[] = [];
            newState.doc.descendants((node, pos) => {
              if (node.type.name === 'injectedComponent') {
                components.push({
                  instanceId: node.attrs.instanceId,
                  componentType: node.attrs.componentType,
                  componentData: node.attrs.data,
                  position: pos,
                });
              }
            });

            // Check if components changed
            const oldComponents = value.components;
            const hasChanges =
              components.length !== oldComponents.length ||
              components.some((comp, idx) => {
                const oldComp = oldComponents[idx];
                return (
                  !oldComp ||
                  comp.instanceId !== oldComp.instanceId ||
                  JSON.stringify(comp.componentData) !==
                  JSON.stringify(oldComp.componentData)
                );
              });

            // Notify if changed
            if (hasChanges && options.onComponentsChanged) {
              // Use setTimeout to avoid calling during state update
              setTimeout(() => {
                options.onComponentsChanged?.(components);
              }, 0);
            }

            return { components };
          },
        },
        props: {
          handleDOMEvents: {
            click(view, event) {
              const target = event.target as HTMLElement;
              const componentNode = target.closest('[data-injected-component]');

              if (componentNode) {
                const instanceId = componentNode.getAttribute('data-instance-id');
                if (instanceId && options.onComponentClick) {
                  options.onComponentClick(instanceId);
                  return true;
                }
              }

              return false;
            },
          },
        },
      }),
    ];
  },
});

export default ComponentInjection;
