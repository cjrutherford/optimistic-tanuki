import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { LeadDetailModalComponent } from './lead-detail-modal.component';
import { Lead, LeadSource, LeadStatus } from './leads.types';

describe('LeadDetailModalComponent', () => {
  const lead: Lead = {
    id: 'lead-1',
    name: 'John Doe',
    company: 'Acme Corp',
    email: 'john@acme.com',
    phone: '555-1234',
    source: LeadSource.REFERRAL,
    status: LeadStatus.NEW,
    value: 5000,
    notes: 'Interested in modernization support',
    nextFollowUp: undefined,
    isAutoDiscovered: true,
    searchKeywords: ['react'],
    originalPostingUrl: 'https://example.com/jobs/123',
    contacts: [
      {
        kind: 'email',
        value: 'john@acme.com',
        href: 'mailto:john@acme.com',
        label: 'Email John Doe',
        source: 'provider',
        isPrimary: true,
      },
      {
        kind: 'phone',
        value: '555-1234',
        href: 'tel:555-1234',
        label: 'Call John Doe',
        source: 'posting-page',
        isPrimary: false,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeadDetailModalComponent],
    }).compileComponents();
  });

  it('renders live posting and contact links', () => {
    const fixture = TestBed.createComponent(LeadDetailModalComponent);
    fixture.componentInstance.lead = lead;
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(By.css('a'));
    const hrefs = links.map((link) => link.nativeElement.getAttribute('href'));

    expect(hrefs).toEqual(
      expect.arrayContaining([
        'https://example.com/jobs/123',
        'mailto:john@acme.com',
        'tel:555-1234',
      ])
    );
  });

  describe('outreach composer', () => {
    const buildFixture = () => {
      const fixture = TestBed.createComponent(LeadDetailModalComponent);
      fixture.componentInstance.lead = lead;
      fixture.detectChanges();
      return fixture;
    };

    it('will not record an empty message as sent', () => {
      const fixture = buildFixture();
      const sent = jest.fn();
      fixture.componentInstance.outreachSent.subscribe(sent);

      fixture.componentInstance.onMarkAsSent();

      expect(fixture.componentInstance.canSendOutreach).toBe(false);
      expect(sent).not.toHaveBeenCalled();
    });

    it('reports what the user actually wrote', () => {
      const fixture = buildFixture();
      const sent = jest.fn();
      fixture.componentInstance.outreachSent.subscribe(sent);

      fixture.componentInstance.outreachSubject = '  Your site  ';
      fixture.componentInstance.outreachMessage = '  I can help.  ';
      fixture.componentInstance.onMarkAsSent();

      expect(sent).toHaveBeenCalledWith({
        leadId: 'lead-1',
        subject: 'Your site',
        message: 'I can help.',
      });
    });

    it('clears the draft when a different lead is shown', () => {
      const fixture = buildFixture();
      fixture.componentInstance.outreachMessage = 'Written for Acme.';

      fixture.componentInstance.lead = {
        ...lead,
        id: 'lead-2',
        company: 'Globex',
      };
      fixture.detectChanges();

      // Carrying a draft across leads is how one company's message reaches
      // another company.
      expect(fixture.componentInstance.outreachMessage).toBe('');
      expect(fixture.componentInstance.outreachSubject).toBe(
        'Question about Globex'
      );
    });

    it('builds a mail handoff only once there is something to send', () => {
      const fixture = buildFixture();
      expect(fixture.componentInstance.mailtoHref).toBeNull();

      fixture.componentInstance.outreachSubject = 'Your site';
      fixture.componentInstance.outreachMessage = 'I can help.';

      expect(fixture.componentInstance.mailtoHref).toBe(
        'mailto:john%40acme.com?subject=Your%20site&body=I%20can%20help.'
      );
    });

    it('fills the composer from a drafted message', () => {
      const fixture = buildFixture();

      fixture.componentInstance.outreachDraft = {
        leadId: 'lead-1',
        draft: {
          subject: 'Your booking page',
          greeting: 'Hello Acme Corp,',
          opening: 'I noticed Acme Corp has no website listed.',
          body: ['I build booking systems for clinics.'],
          closing: 'Worth a short conversation?',
          signOff: 'Thanks,',
        },
        evidence: { removedClaims: [], observedSignals: [], clean: true },
        version: 1,
        modelGenerated: true,
        generatedAt: new Date().toISOString(),
      } as any;

      expect(fixture.componentInstance.outreachSubject).toBe(
        'Your booking page'
      );
      // Assembled in reading order, blank-line separated, ready to send.
      expect(fixture.componentInstance.outreachMessage).toBe(
        [
          'Hello Acme Corp,',
          'I noticed Acme Corp has no website listed.',
          'I build booking systems for clinics.',
          'Worth a short conversation?',
          'Thanks,',
        ].join('\n\n')
      );
    });

    it('drops a draft belonging to a lead the user has moved on from', () => {
      const fixture = buildFixture();
      fixture.componentInstance.outreachDraft = {
        leadId: 'lead-1',
        draft: {
          subject: 'Your booking page',
          greeting: 'Hello,',
          opening: '',
          body: [],
          closing: '',
          signOff: '',
        },
        evidence: { removedClaims: [], observedSignals: [], clean: true },
        version: 1,
        modelGenerated: true,
        generatedAt: new Date().toISOString(),
      } as any;

      fixture.componentInstance.lead = { ...lead, id: 'lead-2' };

      expect(fixture.componentInstance.outreachDraft).toBeNull();
      expect(fixture.componentInstance.outreachMessage).toBe('');
    });

    it('warns before handing a long message to a mail client that would clip it', () => {
      const fixture = buildFixture();
      fixture.componentInstance.outreachSubject = 'Your site';

      fixture.componentInstance.outreachMessage = 'a'.repeat(1500);
      expect(fixture.componentInstance.isLongMessage).toBe(false);

      fixture.componentInstance.outreachMessage = 'a'.repeat(1501);
      expect(fixture.componentInstance.isLongMessage).toBe(true);
    });
  });
});
