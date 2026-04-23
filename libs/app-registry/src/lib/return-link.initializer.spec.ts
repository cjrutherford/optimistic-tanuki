import { initializeReturnLink } from './return-link.initializer';

describe('initializeReturnLink', () => {
  it('captures return links on app startup', () => {
    const navigation = {
      captureReturnTo: jest.fn(),
    };

    initializeReturnLink(navigation as any)();

    expect(navigation.captureReturnTo).toHaveBeenCalled();
  });
});
