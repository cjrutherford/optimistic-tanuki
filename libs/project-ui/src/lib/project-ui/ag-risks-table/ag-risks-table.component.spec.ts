import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AgRisksTableComponent } from './ag-risks-table.component';
import { Risk } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
// Import to trigger AG Grid module registration
import '@optimistic-tanuki/ag-grid-ui';

describe('AgRisksTableComponent', () => {
  let component: AgRisksTableComponent;
  let fixture: ComponentFixture<AgRisksTableComponent>;
  let compiled: HTMLElement;

  const mockRisks: Risk[] = [
    {
      id: '1',
      description: 'Database performance degradation',
      impact: 'HIGH',
      likelihood: 'LIKELY',
      projectId: 'project-1',
      status: 'OPEN',
      createdBy: 'admin',
      createdAt: new Date('2024-01-01'),
    },
    {
      id: '2',
      description: 'Third-party API dependency',
      impact: 'MEDIUM',
      likelihood: 'POSSIBLE',
      projectId: 'project-1',
      status: 'IN_PROGRESS',
      createdBy: 'admin',
      createdAt: new Date('2024-01-02'),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgRisksTableComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(AgRisksTableComponent);
    component = fixture.componentInstance;
    compiled = fixture.nativeElement;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with empty risks array', () => {
    expect(component.risks).toEqual([]);
  });

  it('should accept risks input and render grid', (done) => {
    component.risks = mockRisks;
    fixture.detectChanges();

    setTimeout(() => {
      expect(component.risks.length).toBe(2);

      const agGrid = compiled.querySelector('otui-ag-grid');
      expect(agGrid).toBeTruthy();

      done();
    }, 500);
  });

  it('should have column definitions configured with all required columns', () => {
    expect(component.columnDefs).toBeDefined();
    expect(component.columnDefs.length).toBeGreaterThan(0);

    const descriptionColumn = component.columnDefs.find(
      (col) => col.field === 'description'
    );
    const impactColumn = component.columnDefs.find(
      (col) => col.field === 'impact'
    );
    const likelihoodColumn = component.columnDefs.find(
      (col) => col.field === 'likelihood'
    );
    const statusColumn = component.columnDefs.find(
      (col) => col.field === 'status'
    );

    expect(descriptionColumn).toBeDefined();
    expect(impactColumn).toBeDefined();
    expect(likelihoodColumn).toBeDefined();
    expect(statusColumn).toBeDefined();
  });

  it('should emit createRisk event with correct data', (done) => {
    component.createRisk.subscribe((risk) => {
      expect(risk.description).toBe('New Risk');
      expect(risk.impact).toBe('LOW');
      done();
    });

    component.onCreateFormSubmit({
      id: '3',
      description: 'New Risk',
      impact: 'LOW',
      likelihood: 'UNLIKELY',
      projectId: 'project-1',
      status: 'OPEN',
      createdBy: 'admin',
      createdAt: new Date(),
    });
  });

  it('should emit editRisk event with correct data', (done) => {
    const riskToEdit = mockRisks[0];
    component.editRisk.subscribe((risk) => {
      expect(risk.id).toBe('1');
      expect(risk.description).toBe('Database performance degradation');
      done();
    });

    component.onEditFormSubmit(riskToEdit);
  });

  it('should set selected risk for editing', () => {
    const risk = mockRisks[0];
    component.onEdit(risk);
    expect(component.selectedRisk).toEqual(risk);
    expect(component.showEditModal).toBe(true);
  });

  it('should update grid when risks input changes', (done) => {
    component.risks = [];
    fixture.detectChanges();

    component.risks = mockRisks;
    component.ngOnChanges({
      risks: {
        currentValue: mockRisks,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });
    fixture.detectChanges();

    setTimeout(() => {
      expect(component.risks.length).toBe(2);
      done();
    }, 300);
  });

  it('should have grid options configured for risks', () => {
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
});
