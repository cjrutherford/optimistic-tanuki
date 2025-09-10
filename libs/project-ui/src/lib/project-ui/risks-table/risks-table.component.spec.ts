import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Risk } from '@optimistic-tanuki/ui-models';
import { SimpleChange } from '@angular/core';
import { RisksTableComponent } from './risks-table.component';
import { By } from '@angular/platform-browser';
import { TableComponent } from '@optimistic-tanuki/common-ui';

describe('RisksTableComponent', () => {
  let component: RisksTableComponent;
  let fixture: ComponentFixture<RisksTableComponent>;

  const mockRisks: Risk[] = [
    {
      id: '1',
      projectId: 'project-1',
      description: 'Risk 1',
      impact: 'HIGH',
      likelihood: 'LIKELY',
      status: 'OPEN',
      createdBy: 'user1',
      createdAt: new Date(),
    },
    {
      id: '2',
      projectId: 'project-1',
      description: 'Risk 2',
      impact: 'MEDIUM',
      likelihood: 'POSSIBLE',
      status: 'CLOSED',
      createdBy: 'user2',
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RisksTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(RisksTableComponent);
    component = fixture.componentInstance;
    component.risks = [];
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display risks in the table', () => {
    component.risks = mockRisks;
    component.ngOnChanges({
      risks: new SimpleChange([], mockRisks, true),
    });
    fixture.detectChanges();

    const tableDebugElements = fixture.debugElement.queryAll(
      By.directive(TableComponent)
    );
    expect(tableDebugElements.length).toBe(mockRisks.length);

    const firstTableComponent = tableDebugElements[0].componentInstance;
    expect(firstTableComponent.cells[0].value).toBe('Risk 1');
    expect(firstTableComponent.cells[1].value).toBe('HIGH');
    expect(firstTableComponent.cells[2].value).toBe('LIKELY');
    expect(firstTableComponent.cells[3].value).toBe('OPEN');
    expect(firstTableComponent.cells[4].value).toBe('user1');
  });

  it('should open edit modal and set selected risk when edit action is triggered', () => {
    component.risks = mockRisks;
    component.ngOnChanges({
      risks: new SimpleChange([], mockRisks, false),
    });
    fixture.detectChanges();

    const editAction = component.tableActions().find((a) => a.title === 'Edit');
    expect(editAction).toBeDefined();

    editAction!.action(0);
    fixture.detectChanges();

    expect(component.showEditModal()).toBe(true);
    expect(component.selectedRisk()).toEqual(mockRisks[0]);
  });

  it('should emit deleteRisk event when delete action is triggered', () => {
    jest.spyOn(component.deleteRisk, 'emit');
    component.risks = mockRisks;
    component.ngOnChanges({
      risks: new SimpleChange([], mockRisks, false),
    });
    fixture.detectChanges();

    const deleteAction = component
      .tableActions()
      .find((a) => a.title === 'Delete');
    expect(deleteAction).toBeDefined();

    deleteAction!.action(0);
    fixture.detectChanges();

    expect(component.deleteRisk.emit).toHaveBeenCalledWith('1');
  });
});
