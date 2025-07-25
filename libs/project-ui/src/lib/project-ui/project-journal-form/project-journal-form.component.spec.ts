import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectJournalFormComponent } from './project-journal-form.component';

describe('ProjectJournalFormComponent', () => {
  let component: ProjectJournalFormComponent;
  let fixture: ComponentFixture<ProjectJournalFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectJournalFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectJournalFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
