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
});
