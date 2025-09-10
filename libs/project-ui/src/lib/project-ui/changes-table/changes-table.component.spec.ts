import { ComponentFixture, TestBed } from '@angular/core/testing';

import { By } from '@angular/platform-browser';
import { Change } from '@optimistic-tanuki/ui-models';
import { ChangesTableComponent } from './changes-table.component';
import { SimpleChange } from '@angular/core';
import { TableComponent } from '@optimistic-tanuki/common-ui';

describe('ChangesTableComponent', () => {
  let component: ChangesTableComponent;
  let fixture: ComponentFixture<ChangesTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChangesTableComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChangesTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default changes and set cellular data', () => {
    expect(component.changes.length).toBeGreaterThan(0);
    expect(component.cells()).not.toEqual([]);
  });

  it('should update cellular data when changes input changes', () => {
    const newChanges: Change[] = [
      {
        id: '4',
        changeDescription: 'Description for Change 4',
        changeType: 'ADDITION',
        changeStatus: 'PENDING',
        changeDate: new Date('2024-07-01'),
        requestor: 'Bob',
        approver: 'Charlie',
        resolution: 'PENDING',
        projectId: 'project-4',
        updatedBy: 'admin',
        updatedAt: new Date('2024-07-01')
      },
    ];
    component.changes = newChanges;
    component.ngOnChanges({
      changes: {
        currentValue: newChanges,
        previousValue: [],
        firstChange: true,
        isFirstChange: () => true
      }
    });
    expect(component.cells().length).toEqual(newChanges.length);
    expect(component.cells()[0][0].value).toEqual(newChanges[0].changeDescription);
  });

  it('should set showModal to true when setShowModal is called', () => {
    component.setShowModal();
    expect(component.showModal()).toBe(true);
  });

  it('should set showModal to false when closeModal is called', () => {
    component.setShowModal();
    component.closeModal();
    expect(component.showModal()).toBe(false);
  });

  it('should emit createChange and close modal on onCreateFormSubmit', () => {
    jest.spyOn(component.createChange, 'emit');
    jest.spyOn(component, 'closeModal');
    const newChange: Partial<Change> = {
      changeDescription: 'New Change',
      changeType: 'ADDITION',
      requestor: 'Test',
      approver: 'Test',
      projectId: 'test-project'
    };
    component.onCreateFormSubmit(newChange);
    expect(component.createChange.emit).toHaveBeenCalledWith(expect.objectContaining(newChange));
    expect(component.closeModal).toHaveBeenCalled();
  });



  it('should set selectedChange and showEditModal to true on edit row action', () => {
    const initialChange = component.changes[0];
    component.rowActions[1].action(0); // Index 1 is Edit action
    expect(component.selectedChange()).toEqual(initialChange);
    expect(component.showEditModal()).toBe(true);
  });

  it('should emit deleteChange on delete row action', () => {
    jest.spyOn(component.deleteChange, 'emit');
    const changeToDelete = component.changes[0];
    component.rowActions[2].action(0); // Index 2 is Delete action
    expect(component.deleteChange.emit).toHaveBeenCalledWith(changeToDelete.id);
  });

  it('should emit editChange and close modal on onEditFormSubmit', () => {
    jest.spyOn(component.editChange, 'emit');
    jest.spyOn(component.showEditModal, 'set');
    const existingChange: Change = {
      id: '1',
      changeDescription: 'Original Description',
      changeType: 'ADDITION',
      changeStatus: 'PENDING',
      changeDate: new Date('2024-01-01'),
      requestor: 'Alice',
      approver: 'Bob',
      resolution: 'PENDING',
      projectId: 'project-1',
      updatedBy: 'admin',
      updatedAt: new Date('2024-01-01')
    };
    component.selectedChange.set(existingChange);
    const updatedDescription = 'Updated Description';
    const updatedChange: Partial<Change> = { changeDescription: updatedDescription };
    component.onEditFormSubmit(updatedChange);
    expect(component.editChange.emit).toHaveBeenCalledWith(expect.objectContaining({
      ...existingChange,
      changeDescription: updatedDescription,
      updatedAt: expect.any(Date),
    }));
    expect(component.showEditModal.set).toHaveBeenCalledWith(false);
  });

  it('should set showModal to true and selectedChange to null when setShowModal is called without an index', () => {
    component.setShowModal();
    expect(component.showModal()).toBe(true);
    expect(component.selectedChange()).toBeNull();
  });

  it('should log "View action for row" when view action is triggered', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.rowActions[0].action(0); // Index 0 is View action
    expect(consoleSpy).toHaveBeenCalledWith('View action for row:', 0);
  });

  it('should log "Approve action for row" when approve action is triggered', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.rowActions[3].action(0); // Index 3 is Approve action
    expect(consoleSpy).toHaveBeenCalledWith('Approve action for row:', 0);
  });

  it('should log "Reject action for row" when reject action is triggered', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.rowActions[4].action(0); // Index 4 is Reject action
    expect(consoleSpy).toHaveBeenCalledWith('Reject action for row:', 0);
  });

  it('should log "Request More Info action for row" when request more info action is triggered', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    component.rowActions[5].action(0); // Index 5 is Request More Info action
    expect(consoleSpy).toHaveBeenCalledWith('Request More Info action for row:', 0);
  });
});