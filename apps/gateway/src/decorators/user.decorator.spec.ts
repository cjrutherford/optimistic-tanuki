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

  it('should parse and return user details from a valid JWT', () => {
    // Create a fake JWT with a base64 payload
    const payload = {
      email: 'test@example.com',
      exp: 123,
      iat: 456,
      name: 'Test User',
      userId: 'user-1',
      profileId: '',
    };
    const base64Payload = Buffer.from(JSON.stringify(payload)).toString(
      'base64'
    );
    const token = `header.${base64Payload}.signature`;
    const ctx = createContext(`Bearer ${token}`);
    const result = UserDetailsDecorator(null, ctx);
    expect(result).toEqual(payload);
  });
});
