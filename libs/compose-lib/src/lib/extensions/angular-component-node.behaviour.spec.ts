import { AngularComponentNode } from './angular-component-node.extension';
import { InjectedComponentInstance } from '../interfaces/component-injection.interface';

/**
 * The spec alongside this one asserts that each config hook is defined. These
 * invoke them: parseHTML's attribute extraction, renderHTML's serialisation,
 * and the node view's render/update/destroy cycle. The hooks read `this`, so
 * each is called with an explicit context standing in for the extension.
 */
describe('AngularComponentNode behaviour', () => {
  type RenderContext = {
    options: Record<string, unknown>;
    name?: string;
  };

  const getAttrs = (dom: HTMLElement) => {
    const parsers = AngularComponentNode.config.parseHTML?.call({
      options: {},
    } as never) as Array<{
      tag: string;
      getAttrs?: (el: HTMLElement) => Record<string, unknown> | false;
    }>;
    return parsers[0].getAttrs?.(dom) as Record<string, unknown>;
  };

  const renderHTML = (
    ctx: RenderContext,
    args: { node?: unknown; HTMLAttributes: Record<string, unknown> }
  ) =>
    (
      AngularComponentNode.config.renderHTML as unknown as (
        this: RenderContext,
        a: typeof args
      ) => [string, Record<string, unknown>, ...unknown[]]
    ).call(ctx, args);

  const makeNodeView = (ctx: RenderContext, node: unknown) => {
    const factory = (
      AngularComponentNode.config.addNodeView as unknown as (
        this: RenderContext
      ) => (a: { node: unknown }) => {
        dom: HTMLElement;
        update: (n: unknown) => boolean;
        destroy: () => void;
      }
    ).call(ctx);
    return factory({ node });
  };

  describe('parseHTML getAttrs', () => {
    it('reads the component and instance ids off the element', () => {
      const dom = document.createElement('div');
      dom.setAttribute('data-component-id', 'callout');
      dom.setAttribute('data-instance-id', 'inst-1');

      expect(getAttrs(dom)).toMatchObject({
        componentId: 'callout',
        instanceId: 'inst-1',
      });
    });

    it('parses the serialised data and definition', () => {
      const dom = document.createElement('div');
      dom.setAttribute('data-component-data', '{"title":"Hi"}');
      dom.setAttribute(
        'data-component-def',
        '{"id":"callout","name":"Callout"}'
      );

      expect(getAttrs(dom)).toMatchObject({
        data: { title: 'Hi' },
        componentDef: { id: 'callout', name: 'Callout' },
      });
    });

    it('falls back to nulls and an empty data object', () => {
      expect(getAttrs(document.createElement('div'))).toEqual({
        componentId: null,
        instanceId: null,
        data: {},
        componentDef: null,
      });
    });
  });

  describe('renderHTML', () => {
    const ctx: RenderContext = { options: { HTMLAttributes: {} } };

    it('serialises populated attributes onto the wrapper div', () => {
      const [tag, attrs] = renderHTML(ctx, {
        node: {
          attrs: {
            componentId: 'callout',
            instanceId: 'inst-1',
            data: { title: 'Hi' },
            componentDef: { id: 'callout', name: 'Callout' },
          },
        },
        HTMLAttributes: {},
      });

      expect(tag).toBe('div');
      expect(attrs).toMatchObject({
        'data-angular-component': '',
        'data-component-id': 'callout',
        'data-instance-id': 'inst-1',
        'data-component-data': JSON.stringify({ title: 'Hi' }),
        'data-component-def': JSON.stringify({
          id: 'callout',
          name: 'Callout',
        }),
      });
      expect(String(attrs['class'])).toContain('angular-component-node');
    });

    it('omits data attributes that have nothing to carry', () => {
      const [, attrs] = renderHTML(ctx, {
        node: { attrs: {} },
        HTMLAttributes: {},
      });

      expect(attrs).not.toHaveProperty('data-component-id');
      expect(attrs).not.toHaveProperty('data-instance-id');
      expect(attrs).not.toHaveProperty('data-component-data');
      expect(attrs).not.toHaveProperty('data-component-def');
    });

    it('omits the data attribute for an empty data object', () => {
      const [, attrs] = renderHTML(ctx, {
        node: { attrs: { componentId: 'callout', data: {} } },
        HTMLAttributes: {},
      });

      expect(attrs).not.toHaveProperty('data-component-data');
    });

    it('renders the definition name as the placeholder', () => {
      const result = renderHTML(ctx, {
        node: { attrs: { componentDef: { name: 'Callout Box' } } },
        HTMLAttributes: {},
      });

      expect(result[2]).toEqual([
        'div',
        { class: 'component-placeholder' },
        'Callout Box',
      ]);
    });

    it('falls back to a loading placeholder without a definition', () => {
      const result = renderHTML(ctx, {
        node: { attrs: {} },
        HTMLAttributes: {},
      });

      expect(result[2]).toEqual([
        'div',
        { class: 'component-placeholder' },
        'Angular Component Loading...',
      ]);
    });

    it('tolerates being called with no node at all', () => {
      expect(() =>
        renderHTML(ctx, { node: undefined, HTMLAttributes: {} })
      ).not.toThrow();
    });

    it('keeps complex values out of the DOM attributes', () => {
      // data/componentDef arrive as objects and would stringify to
      // "[object Object]"; they are re-emitted as JSON instead.
      const [, attrs] = renderHTML(ctx, {
        node: { attrs: { componentId: 'callout' } },
        HTMLAttributes: {
          data: { should: 'not leak' },
          componentDef: { should: 'not leak' },
          'data-keep': 'kept',
        },
      });

      expect(attrs['data-keep']).toBe('kept');
      expect(attrs['data']).toBeUndefined();
      expect(attrs['componentDef']).toBeUndefined();
    });

    it('merges the extension-level HTMLAttributes option', () => {
      const [, attrs] = renderHTML(
        { options: { HTMLAttributes: { 'data-from-options': 'yes' } } },
        { node: { attrs: {} }, HTMLAttributes: {} }
      );

      expect(attrs['data-from-options']).toBe('yes');
    });
  });

  describe('addNodeView', () => {
    const node = {
      attrs: {
        componentId: 'callout',
        instanceId: 'inst-1',
        data: { title: 'Hi' },
      },
    };

    const makeInstance = () => {
      const detectChanges = jest.fn();
      const destroy = jest.fn();
      const instance = {
        instanceId: 'inst-1',
        data: { title: 'Hi' },
        componentRef: {
          instance: { componentData: { title: 'Hi' } },
          changeDetectorRef: { detectChanges },
          destroy,
        },
      } as unknown as InjectedComponentInstance;
      return { instance, detectChanges, destroy };
    };

    it('builds a dom node and hands it to the renderer', () => {
      const { instance } = makeInstance();
      const renderer = jest.fn().mockReturnValue(instance);

      const view = makeNodeView(
        { options: { renderer }, name: 'angularComponent' },
        node
      );

      expect(view.dom.classList.contains('angular-component-node')).toBe(true);
      expect(renderer).toHaveBeenCalledWith(
        'callout',
        'inst-1',
        { title: 'Hi' },
        view.dom
      );
    });

    it('works with no renderer configured', () => {
      const view = makeNodeView(
        { options: {}, name: 'angularComponent' },
        node
      );

      expect(view.dom).toBeInstanceOf(HTMLElement);
      expect(
        view.update({ type: { name: 'angularComponent' }, attrs: {} })
      ).toBe(true);
      expect(() => view.destroy()).not.toThrow();
    });

    it('rejects an update for a different node type', () => {
      const { instance } = makeInstance();
      const view = makeNodeView(
        { options: { renderer: () => instance }, name: 'angularComponent' },
        node
      );

      expect(view.update({ type: { name: 'paragraph' }, attrs: {} })).toBe(
        false
      );
    });

    it('merges new data into the wrapper and runs change detection', () => {
      const { instance, detectChanges } = makeInstance();
      const view = makeNodeView(
        { options: { renderer: () => instance }, name: 'angularComponent' },
        node
      );

      const result = view.update({
        type: { name: 'angularComponent' },
        attrs: { data: { subtitle: 'There' } },
      });

      expect(result).toBe(true);
      const wrapper = instance.componentRef.instance as {
        componentData: Record<string, unknown>;
      };
      expect(wrapper.componentData).toEqual({ title: 'Hi', subtitle: 'There' });
      expect(instance.data).toEqual({ title: 'Hi', subtitle: 'There' });
      expect(detectChanges).toHaveBeenCalled();
    });

    it('still records instance data when the wrapper has none', () => {
      const { instance } = makeInstance();
      (
        instance.componentRef.instance as { componentData?: unknown }
      ).componentData = undefined;

      const view = makeNodeView(
        { options: { renderer: () => instance }, name: 'angularComponent' },
        node
      );

      view.update({
        type: { name: 'angularComponent' },
        attrs: { data: { subtitle: 'There' } },
      });

      expect(instance.data).toEqual({ title: 'Hi', subtitle: 'There' });
    });

    it('destroys the rendered component ref', () => {
      const { instance, destroy } = makeInstance();
      const view = makeNodeView(
        { options: { renderer: () => instance }, name: 'angularComponent' },
        node
      );

      view.destroy();

      expect(destroy).toHaveBeenCalled();
    });
  });

  describe('commands', () => {
    type FakeNode = {
      type: { name: string };
      attrs: Record<string, unknown>;
      nodeSize: number;
    };

    const commandsFor = (nodes: FakeNode[] = []) => {
      const built = (
        AngularComponentNode.config.addCommands as unknown as (this: {
          name: string;
        }) => Record<string, (...a: never[]) => (p: never) => boolean>
      ).call({ name: 'angularComponent' });

      const state = {
        doc: {
          descendants: (cb: (n: FakeNode, pos: number) => void) =>
            nodes.forEach((n, i) => cb(n, i * 10)),
        },
      };
      return { built, state };
    };

    const angularNode = (instanceId: string): FakeNode => ({
      type: { name: 'angularComponent' },
      attrs: { instanceId, data: { title: 'old' } },
      nodeSize: 3,
    });

    it('insertAngularComponent inserts a node carrying the supplied attrs', () => {
      const { built } = commandsFor();
      const insertContent = jest.fn().mockReturnValue(true);

      const result = (
        built['insertAngularComponent'] as unknown as (
          o: unknown
        ) => (p: { commands: { insertContent: jest.Mock } }) => boolean
      )({
        componentId: 'callout',
        instanceId: 'inst-1',
        data: { title: 'Hi' },
        componentDef: { id: 'callout', name: 'Callout' },
      })({ commands: { insertContent } });

      expect(result).toBe(true);
      expect(insertContent).toHaveBeenCalledWith({
        type: 'angularComponent',
        attrs: {
          componentId: 'callout',
          instanceId: 'inst-1',
          data: { title: 'Hi' },
          componentDef: { id: 'callout', name: 'Callout' },
        },
      });
    });

    it('updateAngularComponent rewrites the matching node and dispatches', () => {
      const { built, state } = commandsFor([angularNode('inst-1')]);
      const setNodeMarkup = jest.fn();
      const dispatch = jest.fn();
      const tr = { setNodeMarkup };

      const result = (
        built['updateAngularComponent'] as unknown as (
          o: unknown
        ) => (p: { tr: unknown; state: unknown; dispatch?: unknown }) => boolean
      )({ instanceId: 'inst-1', data: { title: 'new' } })({
        tr,
        state,
        dispatch,
      });

      expect(result).toBe(true);
      expect(setNodeMarkup).toHaveBeenCalledWith(0, undefined, {
        instanceId: 'inst-1',
        data: { title: 'new' },
      });
      expect(dispatch).toHaveBeenCalledWith(tr);
    });

    it('updateAngularComponent reports false when nothing matches', () => {
      const { built, state } = commandsFor([angularNode('other')]);
      const dispatch = jest.fn();

      const result = (
        built['updateAngularComponent'] as unknown as (
          o: unknown
        ) => (p: { tr: unknown; state: unknown; dispatch?: unknown }) => boolean
      )({ instanceId: 'inst-1', data: {} })({
        tr: { setNodeMarkup: jest.fn() },
        state,
        dispatch,
      });

      expect(result).toBe(false);
      expect(dispatch).not.toHaveBeenCalled();
    });

    it('updateAngularComponent skips nodes of another type', () => {
      const { built, state } = commandsFor([
        {
          type: { name: 'paragraph' },
          attrs: { instanceId: 'inst-1' },
          nodeSize: 1,
        },
      ]);
      const setNodeMarkup = jest.fn();

      const result = (
        built['updateAngularComponent'] as unknown as (
          o: unknown
        ) => (p: { tr: unknown; state: unknown; dispatch?: unknown }) => boolean
      )({ instanceId: 'inst-1', data: {} })({
        tr: { setNodeMarkup },
        state,
        dispatch: jest.fn(),
      });

      expect(result).toBe(false);
      expect(setNodeMarkup).not.toHaveBeenCalled();
    });

    it('updateAngularComponent applies the edit without a dispatch fn', () => {
      const { built, state } = commandsFor([angularNode('inst-1')]);
      const setNodeMarkup = jest.fn();

      const result = (
        built['updateAngularComponent'] as unknown as (
          o: unknown
        ) => (p: { tr: unknown; state: unknown; dispatch?: unknown }) => boolean
      )({ instanceId: 'inst-1', data: { title: 'new' } })({
        tr: { setNodeMarkup },
        state,
        dispatch: undefined,
      });

      expect(result).toBe(true);
      expect(setNodeMarkup).toHaveBeenCalled();
    });

    it('removeAngularComponent deletes the matching node span', () => {
      const { built, state } = commandsFor([angularNode('inst-1')]);
      const del = jest.fn();

      const result = (
        built['removeAngularComponent'] as unknown as (
          id: string
        ) => (p: { tr: unknown; state: unknown }) => boolean
      )('inst-1')({ tr: { delete: del }, state });

      expect(result).toBe(true);
      expect(del).toHaveBeenCalledWith(0, 3);
    });

    it('removeAngularComponent reports false when nothing matches', () => {
      const { built, state } = commandsFor([angularNode('other')]);
      const del = jest.fn();

      const result = (
        built['removeAngularComponent'] as unknown as (
          id: string
        ) => (p: { tr: unknown; state: unknown }) => boolean
      )('inst-1')({ tr: { delete: del }, state });

      expect(result).toBe(false);
      expect(del).not.toHaveBeenCalled();
    });
  });

  describe('addProseMirrorPlugins', () => {
    it('adds the decoration plugin by default', () => {
      const plugins = (
        AngularComponentNode.config.addProseMirrorPlugins as unknown as (this: {
          options: Record<string, unknown>;
        }) => unknown[]
      ).call({ options: {} });

      expect(plugins).toHaveLength(1);
    });

    it('adds no plugins when default controls are disabled', () => {
      const plugins = (
        AngularComponentNode.config.addProseMirrorPlugins as unknown as (this: {
          options: Record<string, unknown>;
        }) => unknown[]
      ).call({ options: { disableDefaultControls: true } });

      expect(plugins).toEqual([]);
    });
  });
});
