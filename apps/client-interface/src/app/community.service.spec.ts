import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { CommunityService } from './community.service';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

const BASE = 'http://api.test/social/community';

describe('CommunityService', () => {
  let service: CommunityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        CommunityService,
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(CommunityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('creates a community', (done) => {
    const dto = { name: 'Tanuki fans' } as never;
    service.createCommunity(dto).subscribe((res) => {
      expect(res).toEqual({ id: 'c1' });
      done();
    });
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(dto);
    req.flush({ id: 'c1' });
  });

  it('gets a community by id', (done) => {
    service.getCommunity('c1').subscribe((res) => {
      expect(res).toEqual({ id: 'c1' });
      done();
    });
    const req = httpMock.expectOne(`${BASE}/c1`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'c1' });
  });

  it('searches communities', (done) => {
    const criteria = { name: 'tan' } as never;
    service.searchCommunities(criteria).subscribe((res) => {
      expect(res).toHaveLength(1);
      done();
    });
    const req = httpMock.expectOne(`${BASE}/search`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(criteria);
    req.flush([{ id: 'c1' }]);
  });

  it('lists communities without a name filter', (done) => {
    service.listCommunities().subscribe(() => done());
    const req = httpMock.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('url-encodes the name when listing communities by name', (done) => {
    service.listCommunities('a b&c').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}?name=a%20b%26c`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('updates a community', (done) => {
    service
      .updateCommunity('c1', { name: 'new' } as never)
      .subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ id: 'c1' });
  });

  it('deletes a community', (done) => {
    service.deleteCommunity('c1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('joins a community', (done) => {
    service.joinCommunity('c1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ id: 'm1' });
  });

  it('leaves a community', (done) => {
    service.leaveCommunity('c1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1/leave`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('gets members', (done) => {
    service.getMembers('c1').subscribe((m) => {
      expect(m).toEqual([{ id: 'm1' }]);
      done();
    });
    const req = httpMock.expectOne(`${BASE}/c1/members`);
    expect(req.request.method).toBe('GET');
    req.flush([{ id: 'm1' }]);
  });

  it('gets the current user communities', (done) => {
    service.getUserCommunities().subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/user/communities`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('invites a user', (done) => {
    service.inviteUser('c1', 'u2').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1/invite`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ inviteeUserId: 'u2' });
    req.flush({ id: 'i1' });
  });

  it('gets pending invites', (done) => {
    service.getPendingInvites('c1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1/invites`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('gets pending join requests', (done) => {
    service.getPendingJoinRequests('c1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/c1/join-requests`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('approves a member', (done) => {
    service.approveMember('m1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/members/m1/approve`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'm1' });
  });

  it('rejects a member', (done) => {
    service.rejectMember('m1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/members/m1/reject`);
    expect(req.request.method).toBe('POST');
    req.flush(null);
  });

  it('removes a member', (done) => {
    service.removeMember('m1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/members/m1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('cancels an invite', (done) => {
    service.cancelInvite('i1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/invites/i1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('gets communities for a profile id', (done) => {
    service.getUserCommunitiesByProfileId('p1').subscribe(() => done());
    const req = httpMock.expectOne(`${BASE}/profile/p1/communities`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });
});
