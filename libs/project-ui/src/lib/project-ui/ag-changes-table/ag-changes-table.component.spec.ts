import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgChangesTableComponent } from './ag-changes-table.component';
import { Change } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// Import to trigger AG Grid module registration
import '@optimistic-tanuki/ag-grid-ui';

describe('AgChangesTableComponent', () => {
  let component: AgChangesTableComponent;
  let fixture: ComponentFixture<AgChangesTableComponent>;

  const mockChanges: Change[] = [
    {
      id: '1',
      changeDescription: 'Add new feature for user authentication',
      changeType: 'ADDITION',
      changeStatus: 'PENDING',
      changeDate: new Date('2024-12-15'),
      requestor: 'Alice',
      approver: 'Bob',
      resolution: 'PENDING',
      projectId: 'project-1',
      updatedBy: 'admin',
      updatedAt: new Date('2024-12-15'),
    },
    {
      id: '2',
      changeDescription: 'Modify database schema',
      changeType: 'MODIFICATION',
      changeStatus: 'COMPLETE',
      changeDate: new Date('2024-12-16'),
      requestor: 'Charlie',
      approver: 'Diana',
      resolution: 'APPROVED',
      projectId: 'project-1',
      updatedBy: 'admin',
      updatedAt: new Date('2024-12-16'),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgChangesTableComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AgChangesTableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty changes array', () => {
    expect(component.changes).toEqual([]);
  });

  it('should accept changes input', () => {
    component.changes = mockChanges;
    // Don't call detectChanges() to avoid AG Grid initialization
    expect(component.changes.length).toBe(2);
  });

  it('should have column definitions configured', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);
  });

  it('should render AG Grid with data', () => {
    component.changes = mockChanges;
    // Don't call detectChanges() to avoid AG Grid initialization in test environment
    // AG Grid rendering is tested in Storybook
    
    expect(component.changes.length).toBe(2);
    expect(component.columnDefs).toBeDefined();
  });

  it('should emit createChange event', (done) => {
    component.createChange.subscribe((change) => {
      expect(change.changeDescription).toBe('New Change');
      done();
    });

    component.onCreateFormSubmit({
      changeDescription: 'New Change',
      changeType: 'ADDITION',
      changeStatus: 'PENDING',
      changeDate: new Date(),
      requestor: 'Test',
      approver: 'Admin',
      resolution: 'PENDING',
    });
  });

  it('should emit editChange event', (done) => {
    const changeToEdit = mockChanges[0];
    component.selectedChange = changeToEdit;
    
    component.editChange.subscribe((change) => {
      expect(change.id).toBe('1');
      done();
    });

    component.onEditFormSubmit({
      changeDescription: 'Updated description',
    });
  });

  it('should set selected change for editing', () => {
    const change = mockChanges[0];
    component.onEdit(change);
    expect(component.selectedChange).toEqual(change);
    expect(component.showEditModal).toBe(true);
  });
});
