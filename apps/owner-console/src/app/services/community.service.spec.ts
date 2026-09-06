import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import {
  CommunityMemberRole,
  LocalityType,
} from '@optimistic-tanuki/ui-models';

import { CommunityService } from './community.service';

describe('CommunityService', () => {
  let service: CommunityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CommunityService],
    });

    service = TestBed.inject(CommunityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists communities', () => {
    let result: unknown;
    service.getCommunities().subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/communities');
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'c1' }]);
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('reads a single community', () => {
    service.getCommunity('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'c1' });
  });

  it('lists the caller communities', () => {
    service.getMyCommunities().subscribe();
    const req = httpMock.expectOne('/api/communities/my');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('creates a community', () => {
    const dto = { name: 'Neighbours' } as never;
    service.createCommunity(dto).subscribe();
    const req = httpMock.expectOne('/api/communities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'c2' });
  });

  it('updates a community', () => {
    const dto = { name: 'Renamed' } as never;
    service.updateCommunity('c1', dto).subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(dto);
    req.flush({ id: 'c1' });
  });

  it('deletes a community', () => {
    service.deleteCommunity('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('lists community members', () => {
    service.getCommunityMembers('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1/members');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('updates a member role', () => {
    service
      .updateMemberRole('c1', 'm1', CommunityMemberRole.MODERATOR)
      .subscribe();
    const req = httpMock.expectOne('/api/communities/c1/members/m1/role');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ role: CommunityMemberRole.MODERATOR });
    req.flush({ id: 'm1' });
  });

  it('removes a member', () => {
    service.removeMember('c1', 'm1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1/members/m1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('invites a member using only the invitee id in the body', () => {
    service
      .inviteMember({
        communityId: 'c1',
        inviteeUserId: 'u9',
      } as never)
      .subscribe();
    const req = httpMock.expectOne('/api/communities/c1/members/invite');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ inviteeUserId: 'u9' });
    req.flush({ id: 'm2' });
  });

  it('reads the community manager', () => {
    let result: unknown = 'unset';
    service.getCommunityManager('c1').subscribe((r) => (result = r));
    const req = httpMock.expectOne('/api/communities/c1/manager');
    expect(req.request.method).toBe('GET');
    req.flush(null);
    expect(result).toBeNull();
  });

  it('appoints a manager', () => {
    const manager = { userId: 'u1', profileId: 'p1' };
    service.appointManager('c1', manager).subscribe();
    const req = httpMock.expectOne('/api/communities/c1/manager');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(manager);
    req.flush(manager);
  });

  it('revokes a manager', () => {
    service.revokeManager('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1/manager');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('lists cities using the localityType query parameter', () => {
    service.getCities().subscribe();
    const req = httpMock.expectOne('/api/communities?localityType=city');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('reads a city through the community endpoint', () => {
    service.getCity('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'c1' });
  });

  it('creates a city with the CITY locality type forced on', () => {
    service.createCity({ name: 'Springfield' } as never).subscribe();
    const req = httpMock.expectOne('/api/communities');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      name: 'Springfield',
      localityType: LocalityType.CITY,
    });
    req.flush({ id: 'c3' });
  });

  it('updates a city through the community endpoint', () => {
    service.updateCity('c1', { name: 'Shelbyville' } as never).subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'c1' });
  });

  it('deletes a city through the community endpoint', () => {
    service.deleteCity('c1').subscribe();
    const req = httpMock.expectOne('/api/communities/c1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
