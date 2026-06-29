import axios from 'axios';
import {
  OWNER_CONSOLE_SEED_USERS,
  bootstrapOwnerConsoleSeed,
  seedOwnerConsoleUsers,
} from './seed-owner.mjs';

jest.mock('axios');

describe('owner-console development seed', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defines the default development owner credentials', () => {
    expect(OWNER_CONSOLE_SEED_USERS).toEqual([
      expect.objectContaining({
        email: 'test-owner@owner-console.local',
        password: 'Password123!',
      }),
    ]);
  });

  it('registers and logs in the owner through the owner-console app scope', async () => {
    const post = jest
      .fn()
      .mockResolvedValueOnce({ data: { data: { user: { id: 'owner-1' } } } })
      .mockResolvedValueOnce({ data: { data: { token: 'owner-token' } } });
    const httpClient = { post } as any;
    const logger = { log: jest.fn(), warn: jest.fn() };

    const result = await seedOwnerConsoleUsers({
      httpClient,
      logger,
    });

    expect(post).toHaveBeenNthCalledWith(
      1,
      '/authentication/register',
      expect.objectContaining({
        email: 'test-owner@owner-console.local',
        password: 'Password123!',
        confirm: 'Password123!',
      }),
      {
        headers: {
          'x-ot-appscope': 'owner-console',
        },
      }
    );
    expect(post).toHaveBeenNthCalledWith(2, '/authentication/login', {
      email: 'test-owner@owner-console.local',
      password: 'Password123!',
    });
    expect(result).toEqual([
      expect.objectContaining({
        email: 'test-owner@owner-console.local',
        token: 'owner-token',
      }),
    ]);
  });

  it('creates the axios client against the owner-console gateway scope', async () => {
    const create = jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({}),
      post: jest
        .fn()
        .mockResolvedValueOnce({
          data: { data: { user: { id: 'owner-1' } } },
        })
        .mockResolvedValueOnce({
          data: { data: { token: 'owner-token' } },
        }),
    });
    (axios.create as jest.Mock) = create as any;

    await bootstrapOwnerConsoleSeed({
      gatewayUrl: 'http://localhost:3000/api',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:3000/api',
        headers: expect.objectContaining({
          'x-ot-appscope': 'owner-console',
        }),
      })
    );
  });
});
