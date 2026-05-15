import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { SocialGovernanceComponent } from './social-governance.component';
import { SocialGovernanceService } from '../services/social-governance.service';

describe('SocialGovernanceComponent', () => {
  const socialGovernanceService = {
    getReports: jest.fn(),
    updateReport: jest.fn(),
    moderateContent: jest.fn(),
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
    socialGovernanceService.moderateContent.mockReturnValue(
      of({
        success: true,
      })
    );

    await TestBed.configureTestingModule({
      imports: [SocialGovernanceComponent],
      providers: [
        {
          provide: SocialGovernanceService,
          useValue: socialGovernanceService,
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
});
