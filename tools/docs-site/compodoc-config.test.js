const fs = require('node:fs');
const path = require('node:path');

const approvedLibraries = [
  'motion-ui',
  'common-ui',
  'notification-ui',
  'store-ui',
  'auth-ui',
  'profile-ui',
  'chat-ui',
  'message-ui',
  'search-ui',
  'persona-ui',
  'ag-grid-ui',
  'navigation-ui',
  'theme-ui',
  'form-ui',
  'social-ui',
  'blogging-ui',
  'community-ui',
  'forum-ui',
  'project-ui',
];

describe('approved compodoc build configuration', () => {
  it('enables compodoc for storybook and build-storybook targets', () => {
    for (const library of approvedLibraries) {
      const projectPath = path.join(
        __dirname,
        '..',
        '..',
        'libs',
        library,
        'project.json'
      );
      const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

      expect(project.targets.storybook.options.compodoc).toBe(true);
      expect(project.targets['build-storybook'].options.compodoc).toBe(true);

      if (project.targets['storybook-share']) {
        expect(project.targets['storybook-share'].options.compodoc).toBe(true);
      }
    }
  });
});
