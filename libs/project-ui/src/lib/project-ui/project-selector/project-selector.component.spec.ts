import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Project } from '@optimistic-tanuki/ui-models';
import { ProjectSelectorComponent } from './project-selector.component';

describe('ProjectSelectorComponent', () => {
  let component: ProjectSelectorComponent;
  let fixture: ComponentFixture<ProjectSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('emits the selected project when the Edit control is clicked', () => {
    const project = { id: 'project-1', name: 'Roadmap' } as Project;
    const emittedProjects: Project[] = [];
    component.selectedProject.set(project);
    component.editProject.subscribe((selectedProject) =>
      emittedProjects.push(selectedProject)
    );

    const editButton = fixture.nativeElement.querySelectorAll('otui-button')[1];
    editButton.dispatchEvent(new Event('click'));

    expect(emittedProjects).toEqual([project]);
  });

  it('selects a remaining project when the current project is removed', () => {
    const deletedProject = { id: 'project-1', name: 'Deleted' } as Project;
    const remainingProject = { id: 'project-2', name: 'Remaining' } as Project;
    component.projects = [deletedProject, remainingProject];
    component.selectedProject.set(deletedProject);
    component.projectForm.patchValue({ project: deletedProject.id });
    component.projects = [remainingProject];

    component.ngOnChanges({
      projects: new SimpleChange(
        [deletedProject, remainingProject],
        [remainingProject],
        false
      ),
    });

    expect(component.selectedProject()).toEqual(remainingProject);
    expect(component.projectForm.value.project).toBe(remainingProject.id);
  });
});
