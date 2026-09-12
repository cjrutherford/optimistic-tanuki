import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('configurable-client build configuration', () => {
  const project = JSON.parse(
    readFileSync(resolve(__dirname, '../project.json'), 'utf8')
  ) as {
    targets: {
      build: {
        options: {
          server?: string;
          prerender?: boolean;
          ssr?: { entry?: string };
          outputMode?: string;
        };
      };
    };
  };

  it('keeps the SSR runtime without enabling post-bundle route discovery', () => {
    expect(project.targets.build.options.server).toBe(
      'apps/configurable-client/src/main.server.ts'
    );
    expect(project.targets.build.options.ssr).toEqual({
      entry: 'apps/configurable-client/src/server.ts',
    });
    expect(project.targets.build.options.prerender).toBe(false);
    expect(project.targets.build.options).not.toHaveProperty('outputMode');
  });
});
