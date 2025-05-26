import 'jest-preset-angular/setup-jest';
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
  
  jest.mock('quill-magic-url', () => jest.fn());
  jest.mock('quill-image-compress', () => jest.fn());
  jest.mock('quill-cursors', () => jest.fn());
  jest.mock('quill-placeholder-module', () => jest.fn());