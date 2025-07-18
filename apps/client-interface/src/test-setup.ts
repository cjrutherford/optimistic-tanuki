import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
  errorOnUnknownElements: true,
  errorOnUnknownProperties: true,
});

jest.mock('quill', () => {
    return class QuillMock {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      static register() {}
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      constructor() {}
      getSelection() {
        return { index: 0 };
      }
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      insertEmbed() {}
      clipboard = {
        dangerouslyPasteHTML: jest.fn(),
      };
    };
  });
