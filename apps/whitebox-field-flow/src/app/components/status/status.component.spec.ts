import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { StatusComponent } from './status.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';
import { BrandConfigService } from '../../services/brand-config.service';

describe('StatusComponent', () => {
  let component: StatusComponent;
  let fixture: ComponentFixture<StatusComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatusComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        FieldFlowSyncService,
        BrandConfigService,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: {
                get: () => 'demo-job-123',
              },
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatusComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders 4 dispatch status steps', () => {
    expect(component).toBeTruthy();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Scheduled');
    expect(element.textContent).toContain('En Route');
    expect(element.textContent).toContain('Work in Progress');
    expect(element.textContent).toContain('Completed');
  });

  it('renders Google review prompt when job is completed', () => {
    component.updateJobStatus('completed');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Leave a Google review');
  });

  it('allows saving technician notes', () => {
    component.technicianInputNotes = 'Surface sealed with ceramic coat.';
    component.saveTechnicianNotes();
    expect(component.job?.technicianNotes).toBe(
      'Surface sealed with ceramic coat.'
    );
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
