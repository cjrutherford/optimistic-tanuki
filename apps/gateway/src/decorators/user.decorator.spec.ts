import { ExecutionContext } from '@nestjs/common';
import { UserDetailsDecorator } from './user.decorator';

// Helper to create a fake context with a given auth header
function createContext(authHeader?: string, user?: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: authHeader ? { authorization: authHeader } : {},
        user,
      }),
    }),
  } as any;
}

describe('UserDetailsDecorator', () => {
  it('returns the guard-authenticated user for cookie sessions', () => {
    const user = {
      email: 'test@example.com',
      exp: 123,
      iat: 456,
      name: 'Test User',
      userId: 'user-1',
      profileId: 'profile-1',
    };

    expect(UserDetailsDecorator(null, createContext(undefined, user))).toEqual(
      user
    );
  });

  it('returns the requested user field with its actual type', () => {
    const user = {
      email: 'test@example.com',
      exp: 123,
      iat: 456,
      name: 'Test User',
      userId: 'user-1',
      profileId: 'profile-1',
    };

    const userId: string | null = UserDetailsDecorator(
      'userId',
      createContext(undefined, user)
    );

    expect(userId).toBe('user-1');
  });

  it('should return null if no auth header', () => {
    const ctx = createContext();
    const result = UserDetailsDecorator(null, ctx);
    expect(result).toBeNull();
  });

  it('should return null if no token in auth header', () => {
    const ctx = createContext('Bearer');
    const result = UserDetailsDecorator(null, ctx);
    expect(result).toBeNull();
  });

  it('does not trust an authorization header without a guard-authenticated user', () => {
    const ctx = createContext('Bearer header.payload.signature');

    expect(UserDetailsDecorator(null, ctx)).toBeNull();
  });
});
