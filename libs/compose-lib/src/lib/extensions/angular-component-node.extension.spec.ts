import { AngularComponentNode } from './angular-component-node.extension';

describe('AngularComponentNode', () => {
  let extension: any;

  beforeEach(() => {
    extension = AngularComponentNode;
  });

  it('should create extension', () => {
    expect(extension).toBeTruthy();
    expect(extension.name).toBe('angularComponent');
  });

  it('should be configured as block group', () => {
    expect(extension.config.group).toBe('block');
  });

  it('should be atomic', () => {
    expect(extension.config.atom).toBe(true);
  });

  it('should be draggable', () => {
    expect(extension.config.draggable).toBe(true);
  });

  it('should have correct attributes', () => {
    const attributes = extension.config.addAttributes?.();
    expect(attributes).toBeDefined();
    expect(attributes?.componentId).toBeDefined();
    expect(attributes?.instanceId).toBeDefined();
    expect(attributes?.data).toBeDefined();
    expect(attributes?.componentDef).toBeDefined();
  });

  it('should have default options', () => {
    const options = extension.options;
    expect(options).toBeDefined();
    expect(options.HTMLAttributes).toEqual({});
  });

  it('should parse HTML correctly', () => {
    const parseResult = extension.config.parseHTML?.();
    expect(parseResult).toBeDefined();
    expect(parseResult?.[0].tag).toBe('div[data-angular-component]');
  });

  it('should have renderHTML function', () => {
    const renderFn = extension.config.renderHTML;
    expect(renderFn).toBeDefined();
  });

  it('should have addNodeView function', () => {
    const nodeView = extension.config.addNodeView;
    expect(nodeView).toBeDefined();
  });

  it('should have addCommands function', () => {
    const commands = extension.config.addCommands;
    expect(commands).toBeDefined();
  });

  it('should have addProseMirrorPlugins function', () => {
    const plugins = extension.config.addProseMirrorPlugins;
    expect(plugins).toBeDefined();
  });

  describe('Commands', () => {
    it('should have insertAngularComponent command', () => {
      const commands = extension.config.addCommands?.();
      expect(commands).toBeDefined();
      expect(commands?.insertAngularComponent).toBeDefined();
    });

    it('should have updateAngularComponent command', () => {
      const commands = extension.config.addCommands?.();
      expect(commands).toBeDefined();
      expect(commands?.updateAngularComponent).toBeDefined();
    });

    it('should have removeAngularComponent command', () => {
      const commands = extension.config.addCommands?.();
      expect(commands).toBeDefined();
      expect(commands?.removeAngularComponent).toBeDefined();
    });
  });
});
