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
  let compiled: HTMLElement;

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
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty changes array', () => {
    expect(component.changes).toEqual([]);
  });

  it('should accept changes input and render grid', (done) => {
    component.changes = mockChanges;
    fixture.detectChanges();
    
    setTimeout(() => {
      expect(component.changes.length).toBe(2);
      
      const agGrid = compiled.querySelector('otui-ag-grid');
      expect(agGrid).toBeTruthy();
      
      done();
    }, 500);
  });

  it('should have column definitions configured with all required columns', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);
    
    const descriptionColumn = component.columnDefs.find(col => col.field === 'changeDescription');
    const typeColumn = component.columnDefs.find(col => col.field === 'changeType');
    const statusColumn = component.columnDefs.find(col => col.field === 'changeStatus');
    const resolutionColumn = component.columnDefs.find(col => col.field === 'resolution');
    
    expect(descriptionColumn).toBeDefined();
    expect(typeColumn).toBeDefined();
    expect(statusColumn).toBeDefined();
    expect(resolutionColumn).toBeDefined();
  });

  it('should emit createChange event with correct data', (done) => {
    component.createChange.subscribe((change) => {
      expect(change.changeDescription).toBe('New Change');
      expect(change.changeType).toBe('ADDITION');
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

  it('should emit editChange event with correct data', (done) => {
    component.selectedChange = mockChanges[0];
    
    component.editChange.subscribe((change) => {
      expect(change.id).toBe('1');
      expect(change.changeDescription).toContain('Updated');
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

  it('should update grid when changes input changes', (done) => {
    component.changes = [];
    fixture.detectChanges();
    
    component.changes = mockChanges;
    component.ngOnChanges({
      changes: {
        currentValue: mockChanges,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false
      }
    });
    fixture.detectChanges();
    
    setTimeout(() => {
      expect(component.changes.length).toBe(2);
      done();
    }, 300);
  });

  it('should have grid options configured for changes', () => {
    expect(component.gridOptions).toBeDefined();
    expect(component.gridOptions.pagination).toBe(true);
  });

  it('should render action column with edit and delete buttons', () => {
    const actionsColumn = component.columnDefs.find(col => col.headerName === 'Actions');
    expect(actionsColumn).toBeDefined();
    expect(actionsColumn?.cellRenderer).toBeDefined();
  });

  it('should handle modal open/close correctly', () => {
    expect(component.showModal).toBe(false);
    
    component.showModal = true;
    expect(component.showModal).toBe(true);
    
    component.closeModal();
    expect(component.showModal).toBe(false);
  });
});
