import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { PrivacyReportService } from '@optimistic-tanuki/social-data-access';
import { ReportDialogComponent } from './report-dialog.component';

describe('ReportDialogComponent', () => {
  let fixture: ComponentFixture<ReportDialogComponent>;
  let reportRequest: Subject<unknown>;
  let privacyReports: { reportContent: jest.Mock };

  beforeEach(async () => {
    reportRequest = new Subject<unknown>();
    privacyReports = {
      reportContent: jest.fn().mockReturnValue(reportRequest.asObservable()),
    };
    await TestBed.configureTestingModule({
      imports: [ReportDialogComponent],
      providers: [{ provide: PrivacyReportService, useValue: privacyReports }],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDialogComponent);
    fixture.componentRef.setInput('contentType', 'post');
    fixture.componentRef.setInput('contentId', 'post-1');
    fixture.detectChanges();
  });

  it('provides a named dialog and keyboard-visible native reason choices', () => {
    const host = fixture.nativeElement as HTMLElement;
    const dialog = host.querySelector('.modal-dialog');
    const radios = Array.from(
      host.querySelectorAll<HTMLInputElement>('input[type="radio"]')
    );

    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('Report Post');
    expect(host.querySelectorAll('#report-dialog-instructions')).toHaveLength(
      1
    );
    expect(host.querySelector('legend')?.textContent).toContain(
      'Why are you reporting this post?'
    );
    expect(host.querySelector('[aria-label="Close report"]')).not.toBeNull();
    expect(radios.length).toBe(7);
    expect(
      radios.every((radio) => getComputedStyle(radio).display !== 'none')
    ).toBe(true);
    expect(
      radios.map((radio) => radio.parentElement?.textContent?.trim())[0]
    ).toBe('Spam');
  });

  it('requires a reason before requesting a report', () => {
    const host = fixture.nativeElement as HTMLElement;
    const submit = host.querySelector(
      '.dialog-actions otui-button:last-child button'
    ) as HTMLButtonElement;

    expect(submit.disabled).toBe(false);
    submit.click();
    fixture.detectChanges();

    expect(host.querySelector('[role="alert"]')?.textContent).toContain(
      'Choose a reason before submitting.'
    );
    expect(privacyReports.reportContent).not.toHaveBeenCalled();
  });

  it('announces pending and success, submits the target without profile overrides, and stays open for the announcement', () => {
    const component = fixture.componentInstance;
    component.reason = 'spam';
    component.description = 'Repeated unwanted content';
    component.submit();
    fixture.detectChanges();

    expect(privacyReports.reportContent).toHaveBeenCalledWith({
      contentType: 'post',
      contentId: 'post-1',
      reason: 'spam',
      description: 'Repeated unwanted content',
    });
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')
        ?.textContent
    ).toContain('Submitting report');
    expect(component.submissionState()).toBe('pending');
    expect(
      Array.from(
        (
          fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLInputElement>('input[name="report-reason"]')
      ).every((input) => input.matches(':disabled'))
    ).toBe(true);

    reportRequest.next({ id: 'report-1' });
    reportRequest.complete();
    fixture.detectChanges();

    expect(component.submissionState()).toBe('success');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')
        ?.textContent
    ).toContain('Report submitted');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.modal-dialog')
    ).not.toBeNull();
  });

  it('retains the selected reason and details and announces a retryable failure', () => {
    const component = fixture.componentInstance;
    component.reason = 'harassment';
    component.description = 'Context';
    component.submit();
    reportRequest.error(new Error('gateway unavailable'));
    fixture.detectChanges();

    expect(component.submissionState()).toBe('error');
    expect(component.reason).toBe('harassment');
    expect(component.description).toBe('Context');
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role="status"]')
        ?.textContent
    ).toContain('Failed to submit report');
    expect(
      (
        (fixture.nativeElement as HTMLElement).querySelector(
          '.dialog-actions otui-button:last-child button'
        ) as HTMLButtonElement
      ).disabled
    ).toBe(false);
  });
});
