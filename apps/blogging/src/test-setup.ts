jest.mock('jsdom', () => ({
  JSDOM: jest.fn().mockImplementation(() => ({
    window: {
      document: {
        body: {},
        querySelectorAll: jest.fn().mockReturnValue([]),
        createElement: jest.fn().mockReturnValue({
          setAttribute: jest.fn(),
          appendChild: jest.fn(),
          style: {},
        }),
      },
    },
  })),
}));

jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((val) => val),
  addHook: jest.fn(),
}));
