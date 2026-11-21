import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { CommunityService } from '../services/community.service';
import { mergedLocalityRedirectGuard } from './merged-locality.guard';

interface CommunityServiceDouble {
  getCommunityBySlug: jest.Mock;
}
interface RouterDouble {
  parseUrl: jest.Mock;
}

describe('mergedLocalityRedirectGuard', () => {
  const communities: CommunityServiceDouble = {
    getCommunityBySlug: jest.fn(),
  };
  const router: RouterDouble = {
    parseUrl: jest.fn((url: string) => ({ redirected: url })),
  };

  const run = (slug: string, url: string) =>
    TestBed.runInInjectionContext(() =>
      mergedLocalityRedirectGuard(
        {
          paramMap: convertToParamMap({ slug }),
        } as ActivatedRouteSnapshot,
        { url } as RouterStateSnapshot
      )
    );

  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        { provide: CommunityService, useValue: communities },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('lets a locality that was not merged through', async () => {
    communities.getCommunityBySlug.mockResolvedValue({ slug: 'bandera-tx' });
    await expect(run('bandera-tx', '/city/bandera-tx')).resolves.toBe(true);
  });

  it('sends a merged locality to the town that absorbed it, keeping the page and query', async () => {
    communities.getCommunityBySlug.mockResolvedValue({
      slug: 'medina-tx',
      mergedIntoSlug: 'bandera-tx',
    });
    await expect(
      run('medina-tx', '/city/medina-tx/businesses?page=2')
    ).resolves.toEqual({ redirected: '/city/bandera-tx/businesses?page=2' });
  });

  it('sends a former slug to the renamed town, keeping the page and query', async () => {
    communities.getCommunityBySlug.mockResolvedValue({
      slug: 'palm-valley-fl',
      redirectToSlug: 'palm-valley-fl',
    });
    await expect(
      run('ponte-vedra-beach-fl', '/city/ponte-vedra-beach-fl/news?x=1')
    ).resolves.toEqual({ redirected: '/city/palm-valley-fl/news?x=1' });
  });

  it('never blocks navigation when the lookup fails', async () => {
    communities.getCommunityBySlug.mockRejectedValue(new Error('down'));
    await expect(run('medina-tx', '/city/medina-tx')).resolves.toBe(true);
  });
});
