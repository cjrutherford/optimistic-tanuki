import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BugReportUiComponent } from './bug-report-ui.component';
import { BugReportService } from '../bug-report.service';
import { LogBufferService } from '../log-buffer.service';

describe('BugReportUiComponent', () => {
  let fixture: ComponentFixture<BugReportUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BugReportUiComponent],
      providers: [
        {
          provide: BugReportService,
          useValue: {
            report: jest.fn().mockResolvedValue({
              id: 'abc12345',
              emailSent: true,
              issueUrl: null,
            }),
          },
        },
        {
          provide: LogBufferService,
          useValue: {
            start: jest.fn(),
            getSnapshot: () => [],
            getTraceIds: () => [],
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BugReportUiComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('submits description and shows confirmation', async () => {
    const comp = fixture.componentInstance;
    comp.toggle();
    fixture.detectChanges();
    comp.description.set('login broken');
    await comp.submit();
    fixture.detectChanges();
    expect(comp.result()).toContain('received');
  });
});
