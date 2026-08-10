import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type ProductionBuildConfig = {
  targets: {
    build: {
      configurations: {
        production: {
          optimization?: {
            scripts?: boolean;
            styles?: {
              minify?: boolean;
              inlineCritical?: boolean;
            };
            fonts?: {
              inline?: boolean;
            };
          };
        };
      };
    };
  };
};

const projectConfig = (): ProductionBuildConfig =>
  JSON.parse(
    readFileSync(join(process.cwd(), 'apps/forgeofwill/project.json'), 'utf8')
  ) as ProductionBuildConfig;

describe('Forge production build configuration', () => {
  it('disables network font inlining', () => {
    expect(
      projectConfig().targets.build.configurations.production.optimization
        ?.fonts?.inline
    ).toBe(false);
  });

  it('retains script and critical-style optimization', () => {
    const optimization =
      projectConfig().targets.build.configurations.production.optimization;

    expect(optimization?.scripts).toBe(true);
    expect(optimization?.styles?.minify).toBe(true);
    expect(optimization?.styles?.inlineCritical).toBe(true);
  });
});
