import { SafetyReportDialogComponent } from './safety-report-dialog.component';

describe('SafetyReportDialogComponent', () => {
  it('requires a reason and emits a trimmed bounded report payload', () => {
    const component = new SafetyReportDialogComponent();
    component.contentType = 'classified';
    component.contentId = 'listing-1';
    const submitted = jest.fn();
    component.submitted.subscribe(submitted);

    component.submit();
    expect(submitted).not.toHaveBeenCalled();

    component.reason = 'spam';
    component.description = '  deceptive listing  ';
    component.submit();
    expect(submitted).toHaveBeenCalledWith({
      contentType: 'classified',
      contentId: 'listing-1',
      reason: 'spam',
      description: 'deceptive listing',
    });
  });

  it('does not submit a malformed target', () => {
    const component = new SafetyReportDialogComponent();
    component.contentId = ' ';
    component.reason = 'other';
    const submitted = jest.fn();
    component.submitted.subscribe(submitted);

    component.submit();
    expect(submitted).not.toHaveBeenCalled();
  });
});
