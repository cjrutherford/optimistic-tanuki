import { readFileSync } from 'fs';
import { join } from 'path';
import { isValidPersonalityId } from '@optimistic-tanuki/theme-lib';

const repoRoot = join(__dirname, '../../../..');

function readStory(relativePath: string): string {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

describe('theme validation story coverage', () => {
  const showcaseStories = [
    'libs/ag-grid-ui/src/lib/ag-grid-ui/personality-showcase.stories.ts',
    'libs/auth-ui/src/lib/auth-ui/personality-showcase.stories.ts',
    'libs/chat-ui/src/lib/chat-ui/personality-showcase.stories.ts',
    'libs/common-ui/src/lib/common-ui/personality-showcase.stories.ts',
    'libs/form-ui/src/lib/form-ui/personality-showcase.stories.ts',
    'libs/message-ui/src/lib/message/personality-showcase.stories.ts',
    'libs/navigation-ui/src/lib/navigation-ui/personality-showcase.stories.ts',
    'libs/notification-ui/src/lib/personality-showcase.stories.ts',
    'libs/persona-ui/src/lib/persona-ui/personality-showcase.stories.ts',
    'libs/profile-ui/src/lib/profile-ui/personality-showcase.stories.ts',
    'libs/search-ui/src/lib/search-ui/personality-showcase.stories.ts',
    'libs/social-ui/src/lib/social-ui/personality-showcase.stories.ts',
    'libs/store-ui/src/lib/store-ui/personality-showcase.stories.ts',
    'libs/theme-ui/src/lib/theme-ui/personality-showcase.stories.ts',
  ];

  it('keeps a showcase story for each reusable validation library', () => {
    showcaseStories.forEach((storyPath) => {
      expect(() => readStory(storyPath)).not.toThrow();
    });
  });

  it('only references centralized personality ids in verification stories', () => {
    const verificationStories = [
      'libs/common-ui/src/lib/common-ui/personality-visual-check.stories.ts',
      'libs/form-ui/src/lib/form-ui/personality-visual-check.stories.ts',
      'libs/theme-ui/src/lib/theme-ui/personality-preview.component.stories.ts',
    ];

    const ids = verificationStories
      .flatMap((storyPath) =>
        Array.from(readStory(storyPath).matchAll(/personalityId:\s*'([^']+)'/g))
      )
      .map((match) => match[1]);

    expect(ids.length).toBeGreaterThan(0);
    ids.forEach((id) => {
      expect(isValidPersonalityId(id)).toBe(true);
    });
  });
});
