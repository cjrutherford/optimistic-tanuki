import { readFileSync } from 'node:fs';

describe('motion-ui storybook-share target', () => {
  it('binds storybook-share to 0.0.0.0 on the standard port', () => {
    const projectJson = JSON.parse(
      readFileSync('libs/motion-ui/project.json', 'utf8')
    );

    expect(projectJson.targets['storybook-share']).toMatchObject({
      executor: '@storybook/angular:start-storybook',
      options: {
        port: 4400,
        host: '0.0.0.0',
        configDir: 'libs/motion-ui/.storybook',
        browserTarget: 'motion-ui:build-storybook',
        compodoc: false,
      },
    });
  });
});
