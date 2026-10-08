import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { PrivacyService } from '../../privacy.service';
import { ReportDialogComponent } from './report-dialog.component';

describe('ReportDialogComponent', () => {
  let fixture: ComponentFixture<ReportDialogComponent>;
  let privacyService: { reportContent: jest.Mock };

  beforeEach(async () => {
    privacyService = {
      reportContent: jest.fn().mockReturnValue(of(undefined)),
    };
    await TestBed.configureTestingModule({
      imports: [ReportDialogComponent],
      providers: [
        { provide: PrivacyService, useValue: privacyService },
        { provide: MessageService, useValue: { addMessage: jest.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportDialogComponent);
    fixture.componentRef.setInput('contentType', 'post');
    fixture.componentRef.setInput('contentId', 'post-1');
    fixture.detectChanges();
  });

  it('enables submit after a reason is selected and submits that reason', () => {
    const submit = fixture.nativeElement.querySelector(
      '.dialog-actions otui-button:last-child button'
    ) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    const spam = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.radio-option'
      ) as NodeListOf<HTMLElement>
    ).find((option) => option.textContent?.includes('Spam'));
    expect(spam).not.toBeUndefined();
    spam?.click();
    fixture.detectChanges();

    expect(submit.disabled).toBe(false);
    submit.click();
    expect(privacyService.reportContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: 'post',
        contentId: 'post-1',
        reason: 'spam',
      })
    );
  });
});
