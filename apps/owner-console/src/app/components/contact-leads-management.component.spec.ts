import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { LeadStatus } from '@optimistic-tanuki/ui-models';

import { ContactLeadsManagementComponent } from './contact-leads-management.component';
import { ContactLeadsService } from '../services/contact-leads.service';
import { OperatorQueueService } from '../services/operator-queue.service';

describe('ContactLeadsManagementComponent', () => {
  const contactLeadsService = {
    getLeads: jest.fn(),
    updateLead: jest.fn(),
    respondToLead: jest.fn(),
  };
  const operatorQueueService = {
    getQueueByDomain: jest.fn(),
  };
  let storage: Record<string, string>;

  beforeEach(async () => {
    jest.clearAllMocks();
    storage = {};
    const storagePrototype = Object.getPrototypeOf(
      window.localStorage
    ) as Storage;
    jest
      .spyOn(storagePrototype, 'getItem')
      .mockImplementation((key: unknown) => storage[String(key)] ?? null);
    jest
      .spyOn(storagePrototype, 'setItem')
      .mockImplementation((key: unknown, value: unknown) => {
        storage[String(key)] = String(value);
      });
    contactLeadsService.getLeads.mockReturnValue(
      of([
        {
          id: 'lead-1',
          name: 'Acme Co',
          email: 'ops@acme.test',
          phone: '',
          company: 'Acme',
          appScope: 'business-site',
          status: LeadStatus.NEW,
          source: 'local',
          value: 0,
          notes: 'Requested onboarding support',
          isAutoDiscovered: false,
          createdAt: '2026-06-28T09:00:00.000Z',
          updatedAt: '2026-06-29T09:00:00.000Z',
          nextFollowUp: '2026-06-30',
          contactSubject: 'Need help launching',
          contactMessage: 'We need help getting our site live this week.',
          contactSourceLabel: 'Business Site Contact',
        },
        {
          id: 'lead-2',
          name: 'Northwind',
          email: 'hello@northwind.test',
          phone: '555-1000',
          company: 'Northwind',
          appScope: 'client-interface',
          status: LeadStatus.CONTACTED,
          source: 'referral',
          value: 1200,
          notes: 'Warm referral',
          assignedTo: 'ops-1',
          isAutoDiscovered: false,
          createdAt: '2026-07-02T09:00:00.000Z',
          updatedAt: '2026-07-03T09:00:00.000Z',
          lastRespondedAt: '2026-07-03T10:00:00.000Z',
          nextFollowUp: '2026-07-06',
          contactSubject: 'Pricing request',
          contactMessage: 'Can you share pricing?',
          contactSourceLabel: 'Client Interface Contact',
        },
      ])
    );
    contactLeadsService.updateLead.mockImplementation(
      (_id: string, dto: Record<string, unknown>) =>
        of({
          id: 'lead-1',
          name: 'Acme Co',
          email: 'ops@acme.test',
          phone: '',
          company: 'Acme',
          appScope: 'business-site',
          status: dto['status'] ?? LeadStatus.NEW,
          source: 'local',
          value: 0,
          notes: String(dto['notes'] ?? 'Requested onboarding support'),
          assignedTo: (dto['assignedTo'] as string | undefined) ?? 'ops-1',
          isAutoDiscovered: false,
          createdAt: '2026-06-28T09:00:00.000Z',
          updatedAt: '2026-07-04T09:00:00.000Z',
          nextFollowUp:
            (dto['nextFollowUp'] as string | undefined) ?? '2026-07-06',
          contactSubject: 'Need help launching',
          contactMessage: 'We need help getting our site live this week.',
          contactSourceLabel: 'Business Site Contact',
        })
    );
    contactLeadsService.respondToLead.mockReturnValue(
      of({
        lead: {
          id: 'lead-1',
          name: 'Acme Co',
          email: 'ops@acme.test',
          phone: '',
          company: 'Acme',
          appScope: 'business-site',
          status: LeadStatus.CONTACTED,
          source: 'local',
          value: 0,
          notes: 'Requested onboarding support',
          isAutoDiscovered: false,
          createdAt: '2026-06-28T09:00:00.000Z',
          updatedAt: '2026-07-04T09:00:00.000Z',
          lastRespondedAt: '2026-07-04T09:30:00.000Z',
          nextFollowUp: '2026-07-06',
          contactSubject: 'Need help launching',
          contactMessage: 'We need help getting our site live this week.',
          contactSourceLabel: 'Business Site Contact',
        },
        delivery: {
          success: true,
        },
      })
    );
    operatorQueueService.getQueueByDomain.mockReturnValue(
      of([
        {
          id: 'crm-leads-new',
          domain: 'CRM',
          kind: 'lead-first-response',
          severity: 'high',
          title: 'New leads need first response',
          detail: '1 lead is still marked new.',
          route: '/dashboard/contacts',
          status: 'pending',
          sourceTimestamp: '2026-07-01T09:00:00.000Z',
          tags: ['crm'],
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [ContactLeadsManagementComponent, RouterTestingModule],
      providers: [
        { provide: ContactLeadsService, useValue: contactLeadsService },
        { provide: OperatorQueueService, useValue: operatorQueueService },
      ],
    }).compileComponents();
  });

  it('renders the shared CRM queue on the leads workspace', () => {
    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('CRM Queue');
    expect(fixture.nativeElement.textContent).toContain(
      'New leads need first response'
    );
  });

  it('renders CRM workspace metrics, analytics, and sla-focused queue sections', () => {
    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('CRM Workspace');
    expect(text).toContain('Overdue follow-up');
    expect(text).toContain('Source analytics');
    expect(text).toContain('Assignment queues');
    expect(text).toContain('Acme Co');
  });

  it('applies and persists CRM view presets', () => {
    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.applyViewPreset('stale');

    expect(component.activeViewPreset).toBe('stale');
    expect(component.filters.status).toBe(LeadStatus.NEW);
    expect(storage['owner-console.crm-workspace.view']).toBe('stale');
  });

  it('restores a saved CRM view preset from local storage', () => {
    storage['owner-console.crm-workspace.view'] = 'assigned';

    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.activeViewPreset).toBe('assigned');
    expect(component.queueFilter).toBe('assigned');
  });

  it('applies a response template to the selected lead', () => {
    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectLead(component.leads[0]);
    component.applyResponseTemplate('first-touch');

    expect(component.responseModel.subject).toContain('Acme Co');
    expect(component.responseModel.message).toContain(
      'Thanks for reaching out'
    );
  });

  it('builds an interaction timeline for the selected lead', () => {
    const fixture = TestBed.createComponent(ContactLeadsManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.selectLead(component.leads[0]);

    expect(component.interactionTimeline().map((item) => item.kind)).toEqual([
      'created',
      'updated',
      'follow-up',
    ]);
  });
});
