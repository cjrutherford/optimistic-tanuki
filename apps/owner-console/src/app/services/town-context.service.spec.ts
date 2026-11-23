import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CommunityService } from './community.service';
import {
  TOWN_STORAGE_KEY,
  TownContextService,
  swapTownInUrl,
  townIdFromUrl,
} from './town-context.service';

interface CommunityServiceStub {
  getCities: jest.Mock;
  getCommunities: jest.Mock;
}

describe('TownContextService', () => {
  let stub: CommunityServiceStub;

  const create = (): TownContextService => {
    TestBed.configureTestingModule({
      providers: [{ provide: CommunityService, useValue: stub }],
    });
    return TestBed.inject(TownContextService);
  };

  beforeEach(() => {
    localStorage.clear();
    stub = {
      getCities: jest.fn(() =>
        of([
          { id: 'b', name: 'Bayside', city: 'Bayside', adminArea: 'CA' },
          { id: 'a', name: 'Aspen' },
        ])
      ),
      getCommunities: jest.fn(() =>
        of([
          { id: 'c', name: 'Cedar', localityType: 'town' },
          { id: 'd', name: 'Makers Guild', localityType: 'neighborhood' },
          { id: 'a', name: 'Aspen', localityType: 'city' },
        ])
      ),
    };
  });

  it('loads cities and city/town communities, deduped and sorted', () => {
    const service = create();
    service.load();
    expect(service.status()).toBe('ready');
    expect(service.towns().map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(service.towns()[1].subtitle).toBe('Bayside, CA');
  });

  it('reports an error only when both sources fail, and retries', () => {
    stub.getCities.mockReturnValue(throwError(() => new Error('down')));
    stub.getCommunities.mockReturnValue(throwError(() => new Error('down')));
    const service = create();
    service.load();
    expect(service.status()).toBe('error');

    stub.getCities.mockReturnValue(of([{ id: 'a', name: 'Aspen' }]));
    service.load();
    expect(service.status()).toBe('ready');
    expect(service.towns().map((t) => t.id)).toEqual(['a']);
  });

  it('keeps partial data when one source fails', () => {
    stub.getCommunities.mockReturnValue(throwError(() => new Error('down')));
    const service = create();
    service.load();
    expect(service.status()).toBe('ready');
    expect(service.towns().length).toBe(2);
    expect(service.partial()).toBe(true);
  });

  it('does not claim a town is missing when the list is partial', () => {
    stub.getCommunities.mockReturnValue(throwError(() => new Error('down')));
    const service = create();
    service.syncFromUrl('/dashboard/towns/c/overview');
    service.load();
    expect(service.notFound()).toBe(false);

    stub.getCommunities.mockReturnValue(
      of([{ id: 'c', name: 'Cedar', localityType: 'town' }])
    );
    service.load(true);
    expect(service.partial()).toBe(false);
    expect(service.selected()?.id).toBe('c');
  });

  it('persists the selection and restores it', () => {
    const service = create();
    service.load();
    service.select('b');
    expect(localStorage.getItem(TOWN_STORAGE_KEY)).toBe('b');
    expect(service.selected()?.name).toBe('Bayside');

    TestBed.resetTestingModule();
    const again = create();
    again.load();
    expect(again.selected()?.id).toBe('b');
  });

  it('drops a stored town that no longer exists', () => {
    localStorage.setItem(TOWN_STORAGE_KEY, 'gone');
    const service = create();
    service.load();
    expect(service.selected()).toBeNull();
    expect(service.selectedId()).toBeNull();
    expect(localStorage.getItem(TOWN_STORAGE_KEY)).toBeNull();
  });

  it('survives storage that throws', () => {
    const spy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const set = jest
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    try {
      const service = create();
      service.load();
      expect(() => service.select('a')).not.toThrow();
      expect(service.selected()?.id).toBe('a');
    } finally {
      spy.mockRestore();
      set.mockRestore();
    }
  });

  it('lets the URL win over the stored choice', () => {
    localStorage.setItem(TOWN_STORAGE_KEY, 'a');
    const service = create();
    service.load();
    service.syncFromUrl('/dashboard/towns/c/boundary-review');
    expect(service.selected()?.id).toBe('c');
    expect(localStorage.getItem(TOWN_STORAGE_KEY)).toBe('c');
    expect(service.notFound()).toBe(false);
  });

  it('flags an unknown town in the URL as not found without storing it', () => {
    localStorage.setItem(TOWN_STORAGE_KEY, 'a');
    const service = create();
    service.syncFromUrl('/dashboard/towns/nope/overview');
    expect(service.notFound()).toBe(false); // not until towns have loaded
    service.load();
    expect(service.notFound()).toBe(true);
    expect(service.selected()).toBeNull();
    expect(localStorage.getItem(TOWN_STORAGE_KEY)).toBe('a');
  });

  it('is not "not found" off a town URL', () => {
    const service = create();
    service.load();
    service.syncFromUrl('/dashboard/users');
    expect(service.notFound()).toBe(false);
    expect(service.urlTownId()).toBeNull();
  });
});

describe('town URL helpers', () => {
  it('reads the town id from a town URL', () => {
    expect(townIdFromUrl('/dashboard/towns/abc/overview?x=1')).toBe('abc');
    expect(townIdFromUrl('/dashboard/towns')).toBeNull();
    expect(townIdFromUrl('/dashboard/users/abc')).toBeNull();
  });

  it('swaps the town and keeps the tab and query', () => {
    expect(swapTownInUrl('/dashboard/towns/a/boundary-review?x=1', 'b')).toBe(
      '/dashboard/towns/b/boundary-review?x=1'
    );
    expect(swapTownInUrl('/dashboard/users', 'b')).toBeNull();
  });
});
