jest.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));
