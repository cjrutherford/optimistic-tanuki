import loadDatabase from './loadDatabase';

describe('loadDatabase', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it.each(['development', 'production'])(
    'never enables TypeORM synchronize in %s',
    (nodeEnv) => {
      process.env.NODE_ENV = nodeEnv;

      expect(loadDatabase().synchronize).toBe(false);
    }
  );
});
