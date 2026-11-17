import { of, throwError } from 'rxjs';
import { DirectoryController } from './directory.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from './directory.controller';
import { Reflector } from '@nestjs/core';

const id = '11111111-1111-4111-8111-111111111111';
describe('directory gateway', () => {
  const send = jest.fn();
  const controller = new DirectoryController({ send } as any);
  const original = process.env.DIRECTORY_INTERNAL_URL;
  const originalSecret = process.env.DIRECTORY_ELIGIBILITY_SECRET;
  const originalPending = process.env.DIRECTORY_PENDING_READ_SECRET;
  beforeEach(() => {
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_ELIGIBILITY_SECRET = 'eligibility-test';
    delete process.env.DIRECTORY_PENDING_READ_SECRET;
    send.mockReset();
  });
  afterEach(() => {
    process.env.DIRECTORY_INTERNAL_URL = original;
    if (originalSecret === undefined)
      delete process.env.DIRECTORY_ELIGIBILITY_SECRET;
    else process.env.DIRECTORY_ELIGIBILITY_SECRET = originalSecret;
    if (originalPending === undefined)
      delete process.env.DIRECTORY_PENDING_READ_SECRET;
    else process.env.DIRECTORY_PENDING_READ_SECRET = originalPending;
    jest.restoreAllMocks();
  });
  it('uses register authority for a labeled approximate point without the legacy Social read', async () => {
    process.env.DIRECTORY_PENDING_READ_SECRET =
      'pending-secret-for-gateway-123456789';
    const location = {
      coordinates: [-82.5, 31.5],
      label: 'Approximate town location; verified boundary unavailable.',
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'pending',
        approximateLocation: location,
      }),
    } as Response);
    expect(await controller.status(id)).toEqual({
      town: { id },
      status: 'pending',
      approximateLocation: location,
    });
    expect(send).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/internal/register-towns/'),
      expect.objectContaining({
        headers: {
          authorization: `Bearer ${process.env.DIRECTORY_PENDING_READ_SECRET}`,
        },
      })
    );
  });
  it('fails closed for private towns and malformed register status', async () => {
    process.env.DIRECTORY_PENDING_READ_SECRET =
      'pending-secret-for-gateway-123456789';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 404 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'pending',
          approximateLocation: {
            coordinates: [181, 1],
            label: 'Approximate town location; verified boundary unavailable.',
          },
        }),
      } as Response);
    await expect(controller.status(id)).rejects.toMatchObject({ status: 404 });
    await expect(controller.status(id)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('returns only minimal fields and pending for eligible towns', async () => {
    send.mockReturnValue(
      of({ id, name: 'Town', slug: null, adminArea: null, ownerId: 'secret' })
    );
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pending' }),
    } as Response);
    expect(await controller.validate(id, '1', '2')).toEqual({
      town: { id },
      status: 'pending',
    });
  });
  it('canonicalizes uppercase UUIDs for Social, Directory and the public response', async () => {
    const canonicalId = 'abcdef12-abcd-4abc-8abc-abcdef123456';
    send.mockReturnValue(of({ id: canonicalId, name: 'Private name' }));
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'pending' }),
    } as Response);
    expect(await controller.status(canonicalId.toUpperCase())).toEqual({
      town: { id: canonicalId },
      status: 'pending',
    });
    expect(send).toHaveBeenCalledWith(expect.anything(), {
      id: canonicalId,
      secret: 'eligibility-test',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/internal/towns/${canonicalId}/status`),
      expect.anything()
    );
  });
  it('fails closed for malformed or mismatched Social IDs', async () => {
    send
      .mockReturnValueOnce(of({ id: 123 }))
      .mockReturnValueOnce(of({ id: 'abcdef12-abcd-4abc-8abc-abcdef123456' }));
    await expect(controller.status(id)).rejects.toMatchObject({ status: 503 });
    await expect(controller.status(id)).rejects.toMatchObject({ status: 503 });
  });
  it('does not disclose a stale description when privacy changes during the directory request', async () => {
    let eligible = true;
    let release!: (response: Response) => void;
    let started!: () => void;
    const directoryStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    send.mockImplementation(() =>
      of(
        eligible
          ? {
              id,
              name: 'Private name',
              slug: 'private-slug',
              adminArea: 'Private area',
            }
          : null
      )
    );
    jest.spyOn(global, 'fetch').mockImplementation(() => {
      started();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    });
    const pending = controller.status(id);
    await directoryStarted;
    eligible = false;
    release({
      ok: true,
      json: async () => ({ status: 'pending', name: 'Private name' }),
    } as Response);
    expect(await pending).toEqual({ town: { id }, status: 'pending' });
    await expect(controller.status(id)).rejects.toMatchObject({ status: 404 });
  });
  it('fails closed on absent Social, service failures and bad input', async () => {
    send
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(throwError(() => Error('offline')))
      .mockReturnValueOnce(
        of({ id, name: 'Town', slug: null, adminArea: null })
      );
    await expect(controller.status(id)).rejects.toMatchObject({ status: 404 });
    await expect(controller.status(id)).rejects.toMatchObject({ status: 503 });
    jest.spyOn(global, 'fetch').mockRejectedValue(Error('offline'));
    await expect(controller.status(id)).rejects.toMatchObject({ status: 503 });
    await expect(controller.validate(id, '181', '0')).rejects.toMatchObject({
      status: 400,
    });
  });
  it('requires authenticated owner-console access for private boundary candidates', async () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, controller.boundaryCandidate)
    ).toEqual(expect.arrayContaining([AuthGuard, DirectoryOwnerScopeGuard]));
    const guard = new DirectoryOwnerScopeGuard();
    expect(() =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-ot-appscope': 'local-hub' } }),
        }),
      } as any)
    ).toThrow();
    expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-ot-appscope': 'owner-console' } }),
        }),
      } as any)
    ).toBe(true);
  });
  it('rejects anonymous and non-owner sessions before allowing an owner session', async () => {
    const authClient = {
      send: jest.fn().mockReturnValue(of({ isValid: true })),
    };
    const permissions = { send: jest.fn().mockReturnValue(of([])) };
    const jwt = {
      verifyAsync: jest
        .fn()
        .mockResolvedValue({ userId: 'user', profileId: 'profile' }),
    };
    const guard = new AuthGuard(
      authClient as any,
      new Reflector(),
      jwt as any,
      permissions as any,
      { apps: [] } as any
    );
    const makeContext = (authorization?: string) => {
      const request = {
        headers: {
          'x-ot-appscope': 'owner-console',
          ...(authorization ? { authorization } : {}),
        },
      };
      return {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => controller.boundaryCandidate,
        getClass: () => DirectoryController,
      } as any;
    };
    await expect(guard.canActivate(makeContext())).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      guard.canActivate(makeContext('Bearer valid'))
    ).rejects.toMatchObject({ status: 403 });
    permissions.send.mockReturnValue(
      of([{ role: { name: 'owner_console_owner' } }])
    );
    await expect(guard.canActivate(makeContext('Bearer valid'))).resolves.toBe(
      true
    );
  });
  it('sends an independent service credential and exposes only candidate review fields', async () => {
    const originalReview = process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
    process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET =
      'review-secret-for-boundary-123456789';
    try {
      const context = {
        name: 'Douglas Community',
        city: 'Douglas',
        adminArea: 'GA',
        countryCode: 'US',
        localityType: 'city',
      };
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidate: {
            communityId: id,
            geoid: '1323872',
            layer: 'place',
            vintage: '2026',
            stateFips: '13',
            archiveSha256: 'a'.repeat(64),
            reviewContext: { ...context, ownerId: 'private' },
            changeToken: id,
            geographyHash: 'b'.repeat(64),
          },
        }),
      } as Response);
      expect(await controller.boundaryCandidate(id)).toEqual({
        candidate: {
          communityId: id,
          geoid: '1323872',
          layer: 'place',
          vintage: '2026',
          stateFips: '13',
          archiveSha256: 'a'.repeat(64),
          changeToken: id,
          geographyHash: 'b'.repeat(64),
          reviewContext: context,
        },
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/boundary-candidate'),
        expect.objectContaining({
          headers: {
            authorization: `Bearer ${process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET}`,
          },
        })
      );
    } finally {
      if (originalReview === undefined)
        delete process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
      else process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET = originalReview;
    }
  });
  it('fails closed for missing credentials and malformed private responses', async () => {
    const originalReview = process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
    try {
      delete process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
      await expect(controller.boundaryCandidate(id)).rejects.toMatchObject({
        status: 503,
      });
      process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET =
        'review-secret-for-boundary-123456789';
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          candidate: { communityId: id, geoid: 'not-a-geoid' },
        }),
      } as Response);
      await expect(controller.boundaryCandidate(id)).rejects.toMatchObject({
        status: 503,
      });
      await expect(
        controller.boundaryCandidate('invalid')
      ).rejects.toMatchObject({ status: 400 });
    } finally {
      if (originalReview === undefined)
        delete process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET;
      else process.env.DIRECTORY_BOUNDARY_REVIEW_SECRET = originalReview;
    }
  });
  it('binds a boundary decision to the authenticated reviewer and separate write secret', async () => {
    const old = process.env.DIRECTORY_BOUNDARY_DECISION_SECRET;
    process.env.DIRECTORY_BOUNDARY_DECISION_SECRET =
      'decision-write-secret-for-tests-123456';
    try {
      expect(
        Reflect.getMetadata(
          GUARDS_METADATA,
          (controller as any).boundaryDecision
        )
      ).toEqual(expect.arrayContaining([AuthGuard, DirectoryOwnerScopeGuard]));
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, status: 204 } as Response);
      const candidate = {
        communityId: id,
        changeToken: id,
        geoid: '1323872',
        layer: 'place',
        vintage: '2026',
        stateFips: '13',
        archiveSha256: 'a'.repeat(64),
        geographyHash: 'b'.repeat(64),
      };
      const body = {
        requestId: id,
        decision: 'verified',
        attested: true,
        sourceUrl: 'https://www.census.gov/example',
        candidate,
        reviewerId: 'forged',
      };
      await expect(
        (controller as any).boundaryDecision(id, body, {
          user: { profileId: id },
        })
      ).resolves.toEqual({ recorded: true });
      await expect(
        (controller as any).boundaryDecision(
          id,
          { ...body, attested: false },
          { user: { profileId: id } }
        )
      ).rejects.toMatchObject({ status: 400 });
      const options = fetchMock.mock.calls[0][1] as RequestInit;
      expect(JSON.parse(options.body as string).reviewerId).toBe(id);
      expect(options.headers).toEqual(
        expect.objectContaining({
          authorization: `Bearer ${process.env.DIRECTORY_BOUNDARY_DECISION_SECRET}`,
        })
      );
      await expect(
        (controller as any).boundaryDecision(id, body, { user: {} })
      ).rejects.toMatchObject({ status: 403 });
    } finally {
      if (old === undefined)
        delete process.env.DIRECTORY_BOUNDARY_DECISION_SECRET;
      else process.env.DIRECTORY_BOUNDARY_DECISION_SECRET = old;
    }
  });

  it('uses separately enabled containment and fails closed on malformed responses', async () => {
    const old = process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
    process.env.DIRECTORY_CONTAINMENT_READ_SECRET =
      'containment-read-secret-123456789012345';
    try {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ready', covers: true }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ready', covers: 'yes' }),
        } as Response);
      await expect(controller.validate(id, '-82.5', '31.5')).resolves.toEqual({
        town: { id },
        status: 'ready',
        covers: true,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/containment?'),
        expect.objectContaining({
          headers: {
            authorization: `Bearer ${process.env.DIRECTORY_CONTAINMENT_READ_SECRET}`,
          },
        })
      );
      await expect(
        controller.validate(id, '-82.5', '31.5')
      ).rejects.toMatchObject({ status: 503 });
    } finally {
      if (old === undefined)
        delete process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
      else process.env.DIRECTORY_CONTAINMENT_READ_SECRET = old;
    }
  });

  it('exposes a verified boundary only through the enabled containment service', async () => {
    const old = process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
    process.env.DIRECTORY_CONTAINMENT_READ_SECRET =
      'containment-read-secret-123456789012345';
    try {
      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      };
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ status: 'ready', geometry }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            status: 'ready',
            geometry: { type: 'Point', coordinates: [1, 2] },
          }),
        } as Response);
      await expect((controller as any).boundary(id)).resolves.toEqual({
        town: { id },
        status: 'ready',
        geometry,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/boundary'),
        expect.objectContaining({
          headers: {
            authorization: `Bearer ${process.env.DIRECTORY_CONTAINMENT_READ_SECRET}`,
          },
        })
      );
      await expect((controller as any).boundary(id)).rejects.toMatchObject({
        status: 503,
      });
    } finally {
      if (old === undefined)
        delete process.env.DIRECTORY_CONTAINMENT_READ_SECRET;
      else process.env.DIRECTORY_CONTAINMENT_READ_SECRET = old;
    }
  });
});

describe('local directory evaluation gateway', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
  });
  it('only forwards adult listings after an explicit visitor choice', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const listing = {
      name: 'Fixture',
      category: 'adult_entertainment_venue',
      adult: true,
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Example'],
      notices: [],
      termsUrls: [],
    };
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [listing], hasMore: false }),
    } as Response);
    await expect(controller.localListings(id)).rejects.toMatchObject({
      status: 503,
    });
    expect(
      (await controller.localListings(id, '0', '', '1')).listings
    ).toHaveLength(1);
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining('adult=1'),
      expect.anything()
    );
    await expect(
      controller.localListings(id, '0', '', 'false')
    ).rejects.toMatchObject({ status: 400 });
  });
  it('forwards a validated exact category filter', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [], hasMore: false }),
    } as Response);
    await controller.localListings(id, '0', '', undefined, 'restaurant');
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('category=restaurant'),
      expect.anything()
    );
    await expect(
      controller.localListings(id, '0', '', undefined, 'restaurant OR true')
    ).rejects.toMatchObject({ status: 400 });
  });
  it('forwards cursor pagination and preserves the next cursor', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [],
        hasMore: true,
        nextCursor: 'opaque-token',
      }),
    } as Response);
    expect(
      await controller.localListings(
        id,
        '0',
        '',
        undefined,
        'restaurant',
        'cursor',
        'opaque-token'
      )
    ).toMatchObject({ nextCursor: 'opaque-token' });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('pagination=cursor'),
      expect.anything()
    );
    await expect(
      controller.localListings(id, '1', '', undefined, undefined, 'cursor')
    ).rejects.toMatchObject({ status: 400 });
    fetcher.mockResolvedValueOnce({ ok: false, status: 400 } as Response);
    await expect(
      controller.localListings(
        id,
        '0',
        '',
        undefined,
        'restaurant',
        'cursor',
        'tampered'
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it('requests stable IDs for offset listings only when explicitly selected', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ listings: [], hasMore: false }),
    } as Response);
    await controller.localListings(
      id,
      '0',
      '',
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      '1'
    );
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.get('identities')
    ).toBe('1');
    await expect(
      controller.localListings(
        id,
        '0',
        '',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        'false'
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it('forwards bounded search only with cursor pagination and propagates invalid bounds', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ listings: [], hasMore: false, nextCursor: null }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response);
    await controller.localListings(
      id,
      '0',
      '',
      undefined,
      undefined,
      'cursor',
      undefined,
      '-84,30,-82,32'
    );
    expect(
      new URL(String(fetcher.mock.calls[0][0])).searchParams.get('bounds')
    ).toBe('-84,30,-82,32');
    await expect(
      controller.localListings(
        id,
        '0',
        '',
        undefined,
        undefined,
        'cursor',
        undefined,
        'invalid'
      )
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      controller.localListings(
        id,
        '0',
        '',
        undefined,
        undefined,
        undefined,
        undefined,
        '-84,30,-82,32'
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it('projects listing detail without exposing unreviewed coordinates and preserves not-found', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const listing = {
      name: 'Cafe',
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Source'],
      notices: [],
      termsUrls: [],
    };
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ listing }),
    } as Response);
    expect(await controller.localListingDetail(id, 'opaque-token')).toEqual({
      name: 'Cafe',
      category: 'restaurant',
      attribution: ['Source'],
      notices: [],
      termsUrls: [],
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining(`/listings/opaque-token`),
      expect.anything()
    );
    fetcher.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    await expect(
      controller.localListingDetail(id, 'opaque-token')
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      controller.localListingDetail(id, 'bad token')
    ).rejects.toMatchObject({ status: 400 });
  });
  it('preserves only validated opaque detail references in cursor results', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const listing = {
      name: 'Cafe',
      category: 'restaurant',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Source'],
      notices: [],
      termsUrls: [],
      reference: 'opaque-reference',
      id: '00000000-0000-4000-8000-000000000101',
    };
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        listings: [listing],
        hasMore: false,
        nextCursor: null,
      }),
    } as Response);
    const result = await controller.localListings(
      id,
      '0',
      '',
      undefined,
      undefined,
      'cursor'
    );
    expect(result.listings[0].reference).toBe('opaque-reference');
    expect(result.listings[0].id).toBe('00000000-0000-4000-8000-000000000101');
    fetcher.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        listings: [{ ...listing, reference: 'invalid value' }],
        hasMore: false,
        nextCursor: null,
      }),
    } as Response);
    await expect(
      controller.localListings(id, '0', '', undefined, undefined, 'cursor')
    ).rejects.toMatchObject({ status: 503 });
  });
  it('fails closed unless explicitly enabled and forwards only the dedicated credential', async () => {
    const controller = new DirectoryController({ send: jest.fn() } as any);
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    delete process.env.DIRECTORY_LOCAL_EVALUATION;
    await expect(controller.localListings(id)).rejects.toMatchObject({
      status: 503,
    });
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    const listing = {
      name: 'Bakery',
      category: 'bakery',
      location: { type: 'Point', coordinates: [-83, 31] },
      attribution: ['Example'],
      notices: [],
      termsUrls: ['https://example.test/terms'],
      website: 'https://example.test/',
      phone: '+19125550100',
      address: '10 Main St',
    };
    const fetcher = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ listings: [listing], hasMore: false }),
    } as Response);
    expect(await controller.localListings(id)).toEqual({
      listings: [
        {
          name: 'Bakery',
          category: 'bakery',
          attribution: ['Example'],
          notices: [],
          termsUrls: ['https://example.test/terms'],
          website: 'https://example.test/',
          phone: '+19125550100',
          address: '10 Main St',
          coordinates: { lat: 31, lng: -83 },
        },
      ],
      hasMore: false,
    });
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('/internal/local-evaluation/'),
      expect.objectContaining({
        headers: {
          authorization: `Bearer ${process.env.DIRECTORY_LOCAL_EVALUATION_SECRET}`,
        },
      })
    );
    await controller.localListings(id, '25', 'Cafe & Tea');
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining('offset=25&q=Cafe+%26+Tea'),
      expect.anything()
    );
    await expect(
      controller.localListings(id, '0', 'x'.repeat(101))
    ).rejects.toMatchObject({ status: 400 });
    fetcher.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        listings: [
          {
            ...listing,
            website: 'http://127.0.0.1/',
            phone: 'personal',
            address: 'home\naddress',
          },
        ],
        hasMore: false,
      }),
    } as Response);
    const guarded = await controller.localListings(id);
    expect(guarded.listings[0].website).toBeUndefined();
    expect(guarded.listings[0].phone).toBeUndefined();
    expect(guarded.listings[0].address).toBeUndefined();
    expect(guarded.listings[0].coordinates).toBeUndefined();
  });
});

describe('local directory coverage projection', () => {
  const original = { ...process.env };
  const setup = (body: unknown, ok = true, status = 200) => {
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_LOCAL_EVALUATION_SECRET =
      'local-evaluation-secret-1234567890';
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok,
      status,
      json: async () => body,
    } as Response);
    return new DirectoryController({ send: jest.fn() } as any);
  };
  const page = (coverage: unknown) => ({
    listings: [],
    hasMore: false,
    nextCursor: null,
    coverage,
  });
  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
  });

  it.each(['available', 'empty', 'acquiring', 'partial', 'unknown'])(
    'passes through %s',
    async (state) => {
      const c = setup(page({ state, withheldReviewedDetails: 3 }));
      const coverage = { state, withheldReviewedDetails: 3 };
      expect((await c.localListings(id)).coverage).toEqual(coverage);
      expect(
        (await c.localListings(id, '0', '', undefined, undefined, 'cursor'))
          .coverage
      ).toEqual(coverage);
    }
  );

  it.each(['town-ineligible', 'policy-withdrawn'])(
    'passes through blocked with %s and an empty 200 page',
    async (reason) => {
      const c = setup(
        page({ state: 'blocked', reason, withheldReviewedDetails: 0 })
      );
      expect(await c.localListings(id)).toEqual({
        listings: [],
        hasMore: false,
        coverage: { state: 'blocked', reason, withheldReviewedDetails: 0 },
      });
    }
  );

  it.each([
    ['unknown state', { state: 'weird', withheldReviewedDetails: 0 }],
    [
      'reason on non-blocked',
      { state: 'empty', reason: 'town-ineligible', withheldReviewedDetails: 0 },
    ],
    [
      'blocked without reason',
      { state: 'blocked', withheldReviewedDetails: 0 },
    ],
    [
      'blocked with bad reason',
      { state: 'blocked', reason: 'x', withheldReviewedDetails: 0 },
    ],
    ['negative count', { state: 'empty', withheldReviewedDetails: -1 }],
    ['float count', { state: 'empty', withheldReviewedDetails: 1.5 }],
    ['huge count', { state: 'empty', withheldReviewedDetails: 1_000_001 }],
    ['string count', { state: 'empty', withheldReviewedDetails: '2' }],
    ['missing count', { state: 'empty' }],
    ['non-object', 'available'],
  ])('drops malformed coverage: %s', async (_n, coverage) => {
    const c = setup(page(coverage));
    const result = await c.localListings(id);
    expect(result).toEqual({ listings: [], hasMore: false });
    expect('coverage' in result).toBe(false);
  });

  it('strips extra fields', async () => {
    const c = setup(
      page({
        state: 'empty',
        withheldReviewedDetails: 2,
        secret: 'x',
        listingIds: ['a'],
      })
    );
    expect((await c.localListings(id)).coverage).toEqual({
      state: 'empty',
      withheldReviewedDetails: 2,
    });
  });

  it('keeps global failures as 503', async () => {
    const c = setup({}, false, 503);
    await expect(c.localListings(id)).rejects.toMatchObject({ status: 503 });
  });

  it('marks the listing route no-store', () => {
    const headers = Reflect.getMetadata(
      '__headers__',
      DirectoryController.prototype.localListings
    );
    expect(headers).toContainEqual({
      name: 'Cache-Control',
      value: 'no-store',
    });
  });
});
