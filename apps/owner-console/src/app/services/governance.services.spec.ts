import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { ForumService } from './forum.service';
import { SocialGovernanceService } from './social-governance.service';
import { ContactLeadsService } from './contact-leads.service';
import { GovernanceAuditService } from './governance-audit.service';

describe('governance services', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('ForumService', () => {
    let service: ForumService;

    beforeEach(() => {
      service = TestBed.inject(ForumService);
    });

    it('lists topics, threads and posts', () => {
      service.getTopics().subscribe();
      httpMock.expectOne('/api/forum/topics').flush([]);

      service.getThreads().subscribe();
      httpMock.expectOne('/api/forum/threads').flush([]);

      service.getPosts().subscribe();
      httpMock.expectOne('/api/forum/posts').flush([]);
    });

    it('lists moderation reports from the admin endpoint', () => {
      service.getReports().subscribe();
      const req = httpMock.expectOne('/api/forum/admin/reports');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('updates a topic', () => {
      const dto = { name: 'General' } as never;
      service.updateTopic('t1', dto).subscribe();
      const req = httpMock.expectOne('/api/forum/topic/t1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('updates a thread', () => {
      const dto = { title: 'Hello' } as never;
      service.updateThread('th1', dto).subscribe();
      const req = httpMock.expectOne('/api/forum/thread/th1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({});
    });

    it('updates a moderation report', () => {
      service
        .updateReport('rep1', { status: 'actioned', adminNotes: 'removed' })
        .subscribe();
      const req = httpMock.expectOne('/api/forum/admin/reports/rep1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({
        status: 'actioned',
        adminNotes: 'removed',
      });
      req.flush({});
    });

    it('moderates a thread', () => {
      service.moderateThread('th1', { moderationStatus: 'hidden' }).subscribe();
      const req = httpMock.expectOne('/api/forum/admin/thread/th1/moderation');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ moderationStatus: 'hidden' });
      req.flush({});
    });

    it('moderates a post', () => {
      service.moderatePost('po1', { moderationStatus: 'visible' }).subscribe();
      const req = httpMock.expectOne('/api/forum/admin/post/po1/moderation');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ moderationStatus: 'visible' });
      req.flush({});
    });
  });

  describe('SocialGovernanceService', () => {
    let service: SocialGovernanceService;

    beforeEach(() => {
      service = TestBed.inject(SocialGovernanceService);
    });

    it('lists privacy moderation reports', () => {
      service.getReports().subscribe();
      const req = httpMock.expectOne('/api/privacy/admin/reports');
      expect(req.request.method).toBe('GET');
      req.flush([]);
    });

    it('updates a report', () => {
      service.updateReport('r1', { status: 'dismissed' }).subscribe();
      const req = httpMock.expectOne('/api/privacy/admin/reports/r1');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ status: 'dismissed' });
      req.flush({});
    });

    it('moderates social content on the moderation endpoint', () => {
      const dto = {
        contentType: 'post' as const,
        contentId: 'c1',
        moderationStatus: 'hidden' as const,
      };
      service.moderateContent(dto).subscribe();
      const req = httpMock.expectOne('/api/privacy/admin/moderation');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual(dto);
      req.flush({ success: true });
    });
  });

  describe('ContactLeadsService', () => {
    let service: ContactLeadsService;

    beforeEach(() => {
      service = TestBed.inject(ContactLeadsService);
    });

    it('requests leads with no query parameters when no filters are given', () => {
      service.getLeads().subscribe();
      const req = httpMock.expectOne('/api/contact/leads');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys()).toEqual([]);
      req.flush([]);
    });

    it('only forwards the filters that are set', () => {
      service.getLeads({ status: 'new', source: '' }).subscribe();
      const req = httpMock.expectOne(
        (r) =>
          r.url === '/api/contact/leads' && r.params.get('status') === 'new'
      );
      expect(req.request.params.has('source')).toBe(false);
      expect(req.request.params.has('appScope')).toBe(false);
      req.flush([]);
    });

    it('forwards every filter when all are set', () => {
      service
        .getLeads({ status: 'new', source: 'web', appScope: 'business' })
        .subscribe();
      const req = httpMock.expectOne(
        (r) => r.url === '/api/contact/leads' && r.params.has('appScope')
      );
      expect(req.request.params.get('status')).toBe('new');
      expect(req.request.params.get('source')).toBe('web');
      expect(req.request.params.get('appScope')).toBe('business');
      req.flush([]);
    });

    it('reads a single lead', () => {
      service.getLead('l1').subscribe();
      const req = httpMock.expectOne('/api/contact/leads/l1');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'l1' });
    });

    it('patches a lead', () => {
      const dto = { status: 'contacted' } as never;
      service.updateLead('l1', dto).subscribe();
      const req = httpMock.expectOne('/api/contact/leads/l1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual(dto);
      req.flush({ id: 'l1' });
    });

    it('responds to a lead', () => {
      const dto = { message: 'Thanks' } as never;
      let result: unknown;
      service.respondToLead('l1', dto).subscribe((r) => (result = r));
      const req = httpMock.expectOne('/api/contact/leads/l1/respond');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(dto);
      req.flush({ lead: { id: 'l1' }, delivery: { success: true } });
      expect(result).toEqual({
        lead: { id: 'l1' },
        delivery: { success: true },
      });
    });
  });

  describe('GovernanceAuditService', () => {
    let service: GovernanceAuditService;

    beforeEach(() => {
      service = TestBed.inject(GovernanceAuditService);
      localStorage.clear();
    });

    afterEach(() => {
      localStorage.clear();
    });

    it('returns an empty list when nothing has been recorded', () => {
      expect(service.getEntries()).toEqual([]);
    });

    it('records an entry with a generated id and timestamp', () => {
      service.recordEntry({
        kind: 'role-updated',
        roleId: 'r1',
        roleName: 'Admin',
        summary: 'Renamed role',
      });

      const entries = service.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].roleId).toBe('r1');
      expect(entries[0].id).toMatch(/^audit-/);
      expect(Number.isNaN(Date.parse(entries[0].occurredAt))).toBe(false);
    });

    it('prepends newer entries and caps the log at 25', () => {
      for (let i = 0; i < 30; i++) {
        service.recordEntry({
          kind: 'role-deleted',
          roleId: `r${i}`,
          roleName: `Role ${i}`,
          summary: `Deleted ${i}`,
        });
      }

      const entries = service.getEntries();
      expect(entries).toHaveLength(25);
      expect(entries[0].roleId).toBe('r29');
      expect(entries[24].roleId).toBe('r5');
    });

    it('ignores malformed stored payloads', () => {
      localStorage.setItem('owner-console.governance-audit.v1', 'not-json');
      expect(service.getEntries()).toEqual([]);
    });

    it('ignores stored payloads that are not arrays', () => {
      localStorage.setItem(
        'owner-console.governance-audit.v1',
        JSON.stringify({ nope: true })
      );
      expect(service.getEntries()).toEqual([]);
    });
  });
});
