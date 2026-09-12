describe('BlogController module boundary', () => {
  it('does not load Angular packages when imported by the Gateway runtime', () => {
    const nodeModule = require('module') as {
      _load: (
        request: string,
        parent: NodeModule | null,
        isMain: boolean
      ) => unknown;
    };
    const originalLoad = nodeModule._load;
    nodeModule._load = (request, parent, isMain) => {
      if (request.startsWith('@angular/')) {
        throw new Error(`Angular dependency loaded: ${request}`);
      }
      return originalLoad(request, parent, isMain);
    };

    try {
      expect(() => require('./blog.controller')).not.toThrow();
    } finally {
      nodeModule._load = originalLoad;
    }
  });
});
