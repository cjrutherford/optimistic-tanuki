import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectJournalTableComponent } from './project-journal-table.component';

describe('ProjectJournalTableComponent', () => {
  let component: ProjectJournalTableComponent;
  let fixture: ComponentFixture<ProjectJournalTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectJournalTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectJournalTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
