import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { SocialGovernanceComponent } from './social-governance.component';
import { SocialGovernanceService } from '../services/social-governance.service';
import { OperatorQueueService } from '../services/operator-queue.service';

describe('SocialGovernanceComponent', () => {
  const socialGovernanceService = {
    getReports: jest.fn(),
    getLocalHubOperatorReports: jest.fn(),
    getClientInterfaceOperatorReports: jest.fn(),
    updateReport: jest.fn(),
    updateLocalHubOperatorReport: jest.fn(),
    updateClientInterfaceOperatorReport: jest.fn(),
    moderateContent: jest.fn(),
  };
  const operatorQueueService = {
    getQueueByDomain: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    socialGovernanceService.getReports.mockReturnValue(
      of([
        {
          id: 'report-1',
          reporterId: 'profile-1',
          contentType: 'post',
          contentId: 'post-1',
          reason: 'spam',
          description: 'Spam content',
          status: 'pending',
          adminNotes: '',
          createdAt: new Date(),
        },
      ])
    );
    socialGovernanceService.updateReport.mockReturnValue(
      of({
        id: 'report-1',
        reporterId: 'profile-1',
        contentType: 'post',
        contentId: 'post-1',
        reason: 'spam',
        description: 'Spam content',
        status: 'reviewed',
        adminNotes: 'Checked by owner-console',
        createdAt: new Date(),
      })
    );
    socialGovernanceService.getLocalHubOperatorReports.mockReturnValue(
      of([
        {
          id: 'listing-report',
          reporterId: 'profile-1',
          contentType: 'classified',
          contentId: 'ad-1',
          reason: 'other',
          status: 'pending',
          createdAt: new Date(),
        },
      ])
    );
    socialGovernanceService.getClientInterfaceOperatorReports.mockReturnValue(
      of([
        {
          id: 'post-report',
          reporterId: 'profile-1',
          contentType: 'post',
          contentId: 'post-1',
          reason: 'spam',
          status: 'pending',
          createdAt: new Date(),
        },
      ])
    );
    socialGovernanceService.updateLocalHubOperatorReport.mockReturnValue(
      of({
        id: 'listing-report',
        reporterId: 'profile-1',
        contentType: 'classified',
        contentId: 'ad-1',
        reason: 'other',
        status: 'reviewed',
        createdAt: new Date(),
      })
    );
    socialGovernanceService.updateClientInterfaceOperatorReport.mockReturnValue(
      of({
        id: 'post-report',
        reporterId: 'profile-1',
        contentType: 'post',
        contentId: 'post-1',
        reason: 'spam',
        status: 'reviewed',
        createdAt: new Date(),
      })
    );
    socialGovernanceService.moderateContent.mockReturnValue(
      of({
        success: true,
      })
    );
    operatorQueueService.getQueueByDomain.mockReturnValue(
      of([
        {
          id: 'community-moderation-pending',
          domain: 'Community Ops',
          kind: 'moderation-review',
          severity: 'high',
          title: 'Moderation reports pending review',
          detail: '1 moderation report is waiting.',
          route: '/dashboard/social-governance',
          status: 'pending',
          sourceTimestamp: '2026-07-01T08:00:00.000Z',
          tags: ['community'],
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [SocialGovernanceComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) =>
                  ((
                    {
                      source: 'community-ops',
                      entityType: 'member',
                      entityId: 'community-1:member-2',
                      communityId: 'community-1',
                      communityName: 'Makers Guild',
                      entityTitle: 'profile-2',
                    } as Record<string, string>
                  )[key] ?? null),
              },
            },
          },
        },
        {
          provide: SocialGovernanceService,
          useValue: socialGovernanceService,
        },
        {
          provide: OperatorQueueService,
          useValue: operatorQueueService,
        },
      ],
    }).compileComponents();
  });

  it('loads moderation reports on init', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(socialGovernanceService.getReports).toHaveBeenCalled();
    expect(component.reports.length).toBe(1);
  });

  it('updates moderation status and notes through the governance service', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.reportDrafts['report-1'] = {
      status: 'reviewed',
      adminNotes: 'Checked by owner-console',
    };

    component.saveReport(component.reports[0]);

    expect(socialGovernanceService.updateReport).toHaveBeenCalledWith(
      'report-1',
      {
        status: 'reviewed',
        adminNotes: 'Checked by owner-console',
      }
    );
  });

  it('loads and resolves the Local Hub app operator report queue', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.loadLocalHubOperatorReports();
    expect(
      socialGovernanceService.getLocalHubOperatorReports
    ).toHaveBeenCalled();
    expect(component.reports[0].contentType).toBe('classified');

    component.reportDrafts['listing-report'] = {
      status: 'reviewed',
      adminNotes: 'Listing checked',
    };
    component.saveReport(component.reports[0]);
    expect(
      socialGovernanceService.updateLocalHubOperatorReport
    ).toHaveBeenCalledWith('listing-report', {
      status: 'reviewed',
      adminNotes: 'Listing checked',
    });
  });

  it('loads and resolves the client-interface app operator report queue', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.loadClientInterfaceOperatorReports();
    expect(
      socialGovernanceService.getClientInterfaceOperatorReports
    ).toHaveBeenCalled();
    expect(component.reports[0].contentType).toBe('post');

    component.reportDrafts['post-report'] = {
      status: 'reviewed',
      adminNotes: 'Post report reviewed',
    };
    component.saveReport(component.reports[0]);
    expect(
      socialGovernanceService.updateClientInterfaceOperatorReport
    ).toHaveBeenCalledWith('post-report', {
      status: 'reviewed',
      adminNotes: 'Post report reviewed',
    });
  });

  it('applies a soft takedown for the reported content', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.reportDrafts['report-1'] = {
      status: 'actioned',
      adminNotes: 'Hidden pending review',
    };

    component.applyContentModeration(component.reports[0], 'hidden');

    expect(socialGovernanceService.moderateContent).toHaveBeenCalledWith({
      contentType: 'post',
      contentId: 'post-1',
      moderationStatus: 'hidden',
      adminNotes: 'Hidden pending review',
    });
    expect(socialGovernanceService.updateReport).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({
        status: 'actioned',
      })
    );
  });

  it('renders the shared moderation queue on the governance workspace', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Community Moderation Queue'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'Moderation reports pending review'
    );
  });

  it('renders the scoped Community Ops handoff context when opened from an entity', () => {
    const fixture = TestBed.createComponent(SocialGovernanceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Opened from Community Ops'
    );
    expect(fixture.nativeElement.textContent).toContain('Makers Guild');
    expect(fixture.nativeElement.textContent).toContain('profile-2');
  });
});
