import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgProjectJournalTableComponent } from './ag-project-journal-table.component';
import { ProjectJournal } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// Import to trigger AG Grid module registration
import '@optimistic-tanuki/ag-grid-ui';

describe('AgProjectJournalTableComponent', () => {
  let component: AgProjectJournalTableComponent;
  let fixture: ComponentFixture<AgProjectJournalTableComponent>;
  let compiled: HTMLElement;

  const mockJournals: ProjectJournal[] = [
    {
      id: '1',
      projectId: 'project-1',
      profileId: 'profile-1',
      content: 'Initial project setup completed',
      analysis: 'Project is on track',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      updatedBy: 'admin',
    },
    {
      id: '2',
      projectId: 'project-1',
      profileId: 'profile-2',
      content: 'First sprint planning meeting held',
      analysis: 'Team is aligned on goals',
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      updatedBy: 'admin',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgProjectJournalTableComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AgProjectJournalTableComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty journals array', () => {
    expect(component.journals).toEqual([]);
  });

  it('should accept journals input and render grid', (done) => {
    component.journals = mockJournals;
    fixture.detectChanges();

    setTimeout(() => {
      expect(component.journals.length).toBe(2);

      const agGrid = compiled.querySelector('otui-ag-grid');
      expect(agGrid).toBeTruthy();

      done();
    }, 500);
  });

  it('should have column definitions configured with all required columns', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);

    const contentColumn = component.columnDefs.find(
      (col) => col.field === 'content'
    );
    const analysisColumn = component.columnDefs.find(
      (col) => col.field === 'analysis'
    );
    const createdColumn = component.columnDefs.find(
      (col) => col.field === 'createdAt'
    );

    expect(contentColumn).toBeDefined();
    expect(analysisColumn).toBeDefined();
    expect(createdColumn).toBeDefined();
  });

  it('should have auto-height row configuration for long content', () => {
    expect(component.gridOptions).toBeDefined();

    // Check if wrapText is enabled for content columns
    const contentColumn = component.columnDefs.find(
      (col) => col.field === 'content'
    );
    const analysisColumn = component.columnDefs.find(
      (col) => col.field === 'analysis'
    );

    expect(contentColumn?.wrapText).toBe(true);
    expect(analysisColumn?.wrapText).toBe(true);
  });

  it('should emit createJournalEntry event with correct data', (done) => {
    component.createJournalEntry.subscribe((journal) => {
      expect(journal.content).toBe('New Entry');
      done();
    });

    component.entryCreated({
      content: 'New Entry',
      projectId: 'project-1',
      profileId: 'profile-1',
      createdAt: new Date(),
    });
  });

  it('should emit editJournalEntry event with correct data', (done) => {
    component.selectedJournal.set(mockJournals[0]);

    component.editJournalEntry.subscribe((journal) => {
      expect(journal.id).toBe('1');
      expect(journal.content).toContain('Updated');
      done();
    });

    component.entryUpdated({
      content: 'Updated Content',
    });
  });

  it('should set selected journal for editing', () => {
    const journal = mockJournals[0];
    component.onEdit(journal);
    expect(component.selectedJournal()).toEqual(journal);
    expect(component.showEditModal()).toBe(true);
  });

  it('should update grid when journals input changes', (done) => {
    component.journals = [];
    fixture.detectChanges();

    component.journals = mockJournals;
    component.ngOnChanges({
      journals: {
        currentValue: mockJournals,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    setTimeout(() => {
      expect(component.journals.length).toBe(2);
      done();
    }, 300);
  });

  it('should have grid options configured for journal entries', () => {
    expect(component.gridOptions).toBeDefined();
    expect(component.gridOptions.pagination).toBe(true);
  });

  it('should render action column with edit and delete buttons', () => {
    const actionsColumn = component.columnDefs.find(
      (col) => col.headerName === 'Actions'
    );
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.cellRenderer).toBeDefined();
  });

  it('should handle modal open/close correctly', () => {
    expect(component.showModal()).toBe(false);

    component.showModal.set(true);
    expect(component.showModal()).toBe(true);

    component.closeModal();
    expect(component.showModal()).toBe(false);
  });
});
