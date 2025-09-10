import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectJournalTableComponent } from './project-journal-table.component';
import { SimpleChange, SimpleChanges } from '@angular/core';
import { ProjectJournal } from '@optimistic-tanuki/ui-models';

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

  it('should call initCellularData on ngOnChanges when journals change', () => {
    const spy = jest.spyOn(component as any, 'initCellularData');
    const journals: ProjectJournal[] = [
      {
        id: '1',
        projectId: 'project-1',
        profileId: 'profile-1',
        content: 'Test content',
        createdAt: new Date(),
        analysis: 'Test analysis',
        updatedAt: new Date(),
        updatedBy: 'test',
      },
    ];
    const changes: SimpleChanges = {
      journals: new SimpleChange(undefined, journals, true),
    };
    component.journals = journals;
    component.ngOnChanges(changes);
    expect(spy).toHaveBeenCalled();
  });

  it('should set showModal to true when setShowModal is called', () => {
    component.setShowModal();
    expect(component.showModal()).toBe(true);
  });

  it('should log selected journal when setShowModal is called with an index', () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const journals: ProjectJournal[] = [
      {
        id: '1',
        projectId: 'project-1',
        profileId: 'profile-1',
        content: 'Test content',
        createdAt: new Date(),
        analysis: 'Test analysis',
        updatedAt: new Date(),
        updatedBy: 'test',
      },
    ];
    component.journals = journals;
    component.setShowModal(0);
    expect(consoleSpy).toHaveBeenCalledWith('Selected journal:', journals[0]);
  });

  it('should emit editJournalEntry, set showEditModal to false and selectedJournal to null on entryUpdated', () => {
    const emitSpy = jest.spyOn(component.editJournalEntry, 'emit');
    const journal: ProjectJournal = {
      id: '1',
      projectId: 'project-1',
      profileId: 'profile-1',
      content: 'Original content',
      createdAt: new Date(),
      analysis: 'Original analysis',
      updatedAt: new Date(),
      updatedBy: 'test',
    };
    component.selectedJournal.set(journal);
    const updatedContent = 'Updated content';
    component.entryUpdated({ content: updatedContent });
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ content: updatedContent }));
    expect(component.showEditModal()).toBe(false);
    expect(component.selectedJournal()).toBeNull();
  });

  it('should emit createJournalEntry and call closeModal on entryCreated', () => {
    const emitSpy = jest.spyOn(component.createJournalEntry, 'emit');
    const closeModalSpy = jest.spyOn(component, 'closeModal');
    const newEntry = {
      projectId: 'new-project',
      profileId: 'new-profile',
      content: 'New journal content',
      createdAt: new Date(),
    };
    component.entryCreated(newEntry);
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining(newEntry));
    expect(closeModalSpy).toHaveBeenCalled();
  });

  it('should set showModal to false when closeModal is called', () => {
    component.showModal.set(true);
    component.closeModal();
    expect(component.showModal()).toBe(false);
  });

  it('should call deleteJournalEntry.emit when delete action is triggered', () => {
    const emitSpy = jest.spyOn(component.deleteJournalEntry, 'emit');
    const journals: ProjectJournal[] = [
      {
        id: '1',
        projectId: 'project-1',
        profileId: 'profile-1',
        content: 'Test content',
        createdAt: new Date(),
        analysis: 'Test analysis',
        updatedAt: new Date(),
        updatedBy: 'test',
      },
    ];
    component.journals = journals;
    component.tableActions[2].action(0); // Index 2 is Delete
    expect(emitSpy).toHaveBeenCalledWith('1');
  });

  it('should set selectedJournal and showEditModal to true when edit action is triggered', () => {
    const journals: ProjectJournal[] = [
      {
        id: '1',
        projectId: 'project-1',
        profileId: 'profile-1',
        content: 'Test content',
        createdAt: new Date(),
        analysis: 'Test analysis',
        updatedAt: new Date(),
        updatedBy: 'test',
      },
    ];
    component.journals = journals;
    component.tableActions[1].action(0); // Index 1 is Edit
    expect(component.selectedJournal()).toEqual(journals[0]);
    expect(component.showEditModal()).toBe(true);
  });
});