import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BusinessPageContentDto } from './business-page';
import { SponsorshipContentDto } from './sponsorship';

/**
 * E14 target shapes: validation for the business-page/sponsorship content
 * reads that move from payments to social with the persistence work (O13).
 * No gateway routes change in this slice (G3) — there is no social-side
 * backend to receive them yet.
 */
describe('business content contracts (G3/E14 targets)', () => {
  it('accepts a complete business page', async () => {
    const dto = plainToInstance(BusinessPageContentDto, {
      id: 'page-1',
      communityId: 'community-1',
      ownerId: 'user-1',
      name: 'North Star Outfitters',
      tier: 'pro',
      subscriptionStatus: 'active',
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a missing community link and a bad tier', async () => {
    const dto = plainToInstance(BusinessPageContentDto, {
      ownerId: 'user-1',
      tier: 'platinum',
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['communityId', 'tier', 'subscriptionStatus'].sort()
    );
  });

  it('accepts a complete sponsorship', async () => {
    const dto = plainToInstance(SponsorshipContentDto, {
      communityId: 'community-1',
      userId: 'user-1',
      type: 'banner',
      status: 'active',
      months: 3,
    });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a bad sponsorship type and non-positive months', async () => {
    const dto = plainToInstance(SponsorshipContentDto, {
      communityId: 'community-1',
      userId: 'user-1',
      type: 'popup',
      status: 'active',
      months: 0,
    });
    const errors = await validate(dto);
    expect(errors.map((e) => e.property).sort()).toEqual(
      ['type', 'months'].sort()
    );
  });
});
