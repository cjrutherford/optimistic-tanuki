import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';
import { PresenceService, UserPresence } from './presence.service';

const presence = (userId: string): UserPresence => ({
  userId,
  status: 'online',
  lastSeen: new Date(0),
  isExplicit: true,
});

describe('PresenceService', () => {
  let service: PresenceService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PresenceService],
    });
    service = TestBed.inject(PresenceService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('setPresence', () => {
    it('posts the status for the stored user id', (done) => {
      localStorage.setItem('user', JSON.stringify({ id: 'u1' }));
      service.setPresence('busy').subscribe((res) => {
        expect(res.userId).toBe('u1');
        done();
      });
      const req = httpMock.expectOne('/api/presence');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: 'u1', status: 'busy' });
      req.flush({ ...presence('u1'), status: 'busy' });
    });

    it('falls back to profileId when the stored user has no id', (done) => {
      localStorage.setItem('user', JSON.stringify({ profileId: 'p9' }));
      service.setPresence('away').subscribe(() => done());
      const req = httpMock.expectOne('/api/presence');
      expect(req.request.body).toEqual({ userId: 'p9', status: 'away' });
      req.flush(presence('p9'));
    });

    it('returns a never-emitting observable when nothing is stored', () => {
      const next = jest.fn();
      const complete = jest.fn();
      service.setPresence('online').subscribe({ next, complete });
      expect(next).not.toHaveBeenCalled();
      expect(complete).not.toHaveBeenCalled();
    });

    it('returns a never-emitting observable when the stored user is not JSON', () => {
      localStorage.setItem('user', 'not-json');
      const next = jest.fn();
      service.setPresence('online').subscribe({ next });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns a never-emitting observable when the stored user has no ids', () => {
      localStorage.setItem('user', JSON.stringify({ name: 'nobody' }));
      const next = jest.fn();
      service.setPresence('online').subscribe({ next });
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('gets a single presence', (done) => {
    service.getPresence('u1').subscribe((p) => {
      expect(p?.userId).toBe('u1');
      done();
    });
    const req = httpMock.expectOne('/api/presence/u1');
    expect(req.request.method).toBe('GET');
    req.flush(presence('u1'));
  });

  it('gets a batch of presences', (done) => {
    service.getPresenceBatch(['u1', 'u2']).subscribe((p) => {
      expect(p).toHaveLength(2);
      done();
    });
    const req = httpMock.expectOne('/api/presence/batch');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userIds: ['u1', 'u2'] });
    req.flush([presence('u1'), presence('u2')]);
  });

  it('gets online users', (done) => {
    service.getOnlineUsers().subscribe(() => done());
    const req = httpMock.expectOne('/api/presence/online/users');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('updates last seen', (done) => {
    service.updateLastSeen('u1').subscribe(() => done());
    const req = httpMock.expectOne('/api/presence/u1/last-seen');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });

  it('marks a user offline', (done) => {
    service.setOffline('u1').subscribe(() => done());
    const req = httpMock.expectOne('/api/presence/u1/offline');
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });

  it('emits a new map to allPresences$ when a presence is updated', () => {
    const seen: Map<string, UserPresence>[] = [];
    service.allPresences$.subscribe((m) => seen.push(m));

    expect(seen[0].size).toBe(0);

    service.updatePresence(presence('u1'));

    expect(seen).toHaveLength(2);
    expect(seen[1].get('u1')?.status).toBe('online');
    expect(seen[1]).not.toBe(seen[0]);
  });
});
