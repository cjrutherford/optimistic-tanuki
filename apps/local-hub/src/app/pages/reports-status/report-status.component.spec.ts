import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DirectoryService } from '../../services/directory.service';
import { ReportStatusComponent } from './report-status.component';

interface DirectoryDouble {
  getReportStatus: jest.Mock;
}

describe('ReportStatusComponent', () => {
  let fixture: ComponentFixture<ReportStatusComponent>;
  let directory: DirectoryDouble;
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    directory = { getReportStatus: jest.fn() };
    await TestBed.configureTestingModule({
      imports: [ReportStatusComponent],
      providers: [
        provideRouter([]),
        { provide: DirectoryService, useValue: directory },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReportStatusComponent);
    fixture.detectChanges();
  });

  async function lookup(code: string) {
    fixture.componentInstance.code.set(code);
    await fixture.componentInstance.lookup();
    fixture.detectChanges();
  }

  it('has a labelled input and a status live region', () => {
    expect(el().querySelector('label[for=receipt-code]')).toBeTruthy();
    expect(el().querySelector('[role=status]')).toBeTruthy();
  });

  it.each([
    ['received', 'Received'],
    ['under_review', 'Under review'],
    ['resolved', 'Resolved'],
    ['declined', 'Declined'],
  ])('shows %s as %s with the date', async (status, label) => {
    directory.getReportStatus.mockResolvedValue({
      status,
      reasonCode: 'other',
      createdAt: '2026-11-01T10:00:00.000Z',
    });
    await lookup('ABC');
    expect(directory.getReportStatus).toHaveBeenCalledWith('ABC');
    const region = el().querySelector('[role=status]');
    expect(region?.querySelector('h2')?.textContent).toContain(label);
    expect(region?.textContent).toContain('Submitted');
    expect(region?.textContent).toContain('2026');
  });

  it('says so when the code is unknown', async () => {
    directory.getReportStatus.mockResolvedValue(null);
    await lookup('NOPE');
    expect(el().querySelector('[role=status]')?.textContent).toContain(
      "We couldn't find a report with that code."
    );
  });

  it('asks for a code when empty', async () => {
    await lookup('  ');
    expect(directory.getReportStatus).not.toHaveBeenCalled();
    expect(el().querySelector('[role=status]')?.textContent).toContain(
      'Enter the receipt code'
    );
  });
});
