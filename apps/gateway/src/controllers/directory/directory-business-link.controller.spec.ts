import { of } from 'rxjs';
import {
  DirectoryBusinessLinkController,
  DirectoryBusinessLinkQueueController,
} from './directory-business-link.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { DirectoryOwnerScopeGuard } from './directory.controller';
const town = '11111111-1111-4111-8111-111111111111',
  listing = '22222222-2222-4222-8222-222222222222',
  page = '33333333-3333-4333-8333-333333333333',
  owner = '44444444-4444-4444-8444-444444444444',
  requestId = '55555555-5555-4555-8555-555555555555';
describe('directory business-page linkage', () => {
  const old = { ...process.env };
  afterEach(() => {
    process.env = old;
    jest.restoreAllMocks();
  });
  const clients = () => ({
    social: {
      send: jest
        .fn()
        .mockReturnValue(
          of({
            id: page,
            appScope: 'local-hub',
            isPrivate: false,
            slug: 'my-business',
            name: 'My Business',
          })
        ),
    },
    payments: {
      send: jest
        .fn()
        .mockReturnValue(
          of({
            communityId: page,
            ownerId: owner,
            lemonSqueezySubscriptionId: 'secret',
          })
        ),
    },
  });
  it('protects requests and requires owner-console authorization for reviews', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkController.prototype.request
      )
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkController.prototype.review
      )
    ).toEqual(expect.arrayContaining([AuthGuard, DirectoryOwnerScopeGuard]));
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkController.prototype.revoke
      )
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkController.prototype.mine
      )
    ).toContain(AuthGuard);
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkController.prototype.requests
      )
    ).toEqual(expect.arrayContaining([AuthGuard, DirectoryOwnerScopeGuard]));
  });
  it('allows a page owner to request a match using a public page slug', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as Response);
    await expect(
      controller.request(
        town,
        listing,
        { businessSlug: 'my-business', requestId },
        { user: { userId: owner } } as any
      )
    ).resolves.toEqual({ recorded: true });
    expect(
      JSON.parse(String(fetcher.mock.calls[0][1]?.body)).value
        .businessCommunityId
    ).toBe(page);
    await expect(
      controller.request(
        town,
        listing,
        { businessSlug: '../private', requestId },
        { user: { userId: owner } } as any
      )
    ).rejects.toMatchObject({ status: 400 });
  });
  it('checks page ownership before recording an authenticated request', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as Response);
    await expect(
      controller.request(
        town,
        listing,
        { businessCommunityId: page, requestId },
        { user: { userId: owner } } as any
      )
    ).resolves.toEqual({ recorded: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    c.payments.send.mockReturnValue(
      of({ communityId: page, ownerId: requestId })
    );
    await expect(
      controller.request(
        town,
        listing,
        { businessCommunityId: page, requestId },
        { user: { userId: owner } } as any
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('protects the town-wide queue and projects only required fields', async () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        DirectoryBusinessLinkQueueController.prototype.requests
      )
    ).toEqual(expect.arrayContaining([AuthGuard, DirectoryOwnerScopeGuard]));
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          requests: [
            {
              listingId: listing,
              requestId,
              businessCommunityId: page,
              ownerId: owner,
              secret: 'hidden',
            },
          ],
          nextCursor: null,
        }),
      } as Response);
    const q = new DirectoryBusinessLinkQueueController();
    await expect(q.requests(town, { user: {} } as any)).rejects.toMatchObject({
      status: 403,
    });
    expect(
      await q.requests(town, { user: { profileId: owner } } as any)
    ).toEqual({
      requests: [
        {
          listingId: listing,
          requestId,
          businessCommunityId: page,
          ownerId: owner,
        },
      ],
      nextCursor: null,
    });
  });
  it('limits pending request details to authenticated reviewers', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          requests: [
            {
              requestId,
              businessCommunityId: page,
              ownerId: owner,
              secret: 'hidden',
            },
          ],
        }),
      } as Response);
    await expect(
      controller.requests(town, listing, { user: {} } as any)
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await controller.requests(town, listing, {
        user: { profileId: owner },
      } as any)
    ).toEqual({
      requests: [{ requestId, businessCommunityId: page, ownerId: owner }],
    });
  });
  it('shows only the authenticated owner’s pending and approved requests', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          requests: [
            {
              requestId,
              businessCommunityId: page,
              status: 'approved',
              ownerId: 'hidden',
            },
          ],
        }),
      } as Response);
    await expect(
      controller.mine(town, listing, { user: {} } as any)
    ).rejects.toMatchObject({ status: 403 });
    expect(
      await controller.mine(town, listing, { user: { userId: owner } } as any)
    ).toEqual({
      requests: [{ requestId, businessCommunityId: page, status: 'approved' }],
    });
  });
  it('requires reviewer identity and a still-owned public page before approval', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    const fetcher = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 204 } as Response);
    const body = {
      businessCommunityId: page,
      ownerId: owner,
      requestId,
      decision: 'approve',
      evidenceUrl: 'https://example.org/business',
      attested: true,
    };
    await expect(
      controller.review(town, listing, body, { user: {} } as any)
    ).rejects.toMatchObject({ status: 403 });
    c.payments.send.mockReturnValue(
      of({ communityId: page, ownerId: requestId })
    );
    await expect(
      controller.review(town, listing, body, {
        user: { profileId: owner },
      } as any)
    ).rejects.toMatchObject({ status: 403 });
    expect(fetcher).not.toHaveBeenCalled();
    c.payments.send.mockReturnValue(of({ communityId: page, ownerId: owner }));
    await expect(
      controller.review(town, listing, body, {
        user: { profileId: owner },
      } as any)
    ).resolves.toEqual({ recorded: true });
  });
  it('exposes only a currently public page belonging to the verified owner', async () => {
    process.env.DIRECTORY_LOCAL_EVALUATION = 'true';
    process.env.DIRECTORY_INTERNAL_URL = 'http://directory:3120';
    process.env.DIRECTORY_BUSINESS_LINK_SECRET =
      'business-link-secret-123456789012345';
    const c = clients(),
      controller = new DirectoryBusinessLinkController(
        c.social as any,
        c.payments as any
      );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({
        ok: true,
        json: async () => ({
          link: { businessCommunityId: page, ownerId: owner },
        }),
      } as Response);
    expect(await controller.read(town, listing)).toEqual({
      link: { communityId: page, slug: 'my-business', name: 'My Business' },
    });
    c.social.send.mockReturnValue(
      of({ id: page, isPrivate: true, appScope: 'local-hub' })
    );
    expect(await controller.read(town, listing)).toEqual({ link: null });
    c.social.send.mockReturnValue(
      of({
        id: page,
        isPrivate: false,
        appScope: 'local-hub',
        slug: 'my-business',
        name: 'My Business',
      })
    );
    c.payments.send.mockReturnValue(
      of({ communityId: page, ownerId: requestId })
    );
    expect(await controller.read(town, listing)).toEqual({ link: null });
  });
});
