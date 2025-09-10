import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProjectFormComponent } from './project-form.component';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Project } from '@optimistic-tanuki/ui-models';

describe('ProjectFormComponent', () => {
  let component: ProjectFormComponent;
  let fixture: ComponentFixture<ProjectFormComponent>;
  let fb: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectFormComponent, ReactiveFormsModule],
      providers: [FormBuilder],
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectFormComponent);
    component = fixture.componentInstance;
    fb = TestBed.inject(FormBuilder);

    // Explicitly initialize projectForm here for testing purposes
    component.projectForm = fb.group({
      projectName: fb.control(''),
      projectDescription: fb.control(''),
    });

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should patch form values when project input is provided', () => {
    const mockProject: Project = {
      id: '1',
      name: 'Test Project',
      description: 'Test Description',
      status: 'Active',
      owner: 'test-user',
      members: [],
      startDate: new Date(),
      endDate: new Date(),
      createdBy: 'test-user',
      createdAt: new Date(),
      updatedAt: new Date(),
      tasks: [],
      risks: [],
      changes: [],
      journalEntries: [],
      timers: [],
    };
    component.project = mockProject;
    component.ngOnInit(); // Manually call ngOnInit as it's not called on subsequent @Input changes
    fixture.detectChanges();

    expect(component.projectForm.value.projectName).toEqual(mockProject.name);
    expect(component.projectForm.value.projectDescription).toEqual(mockProject.description);
  });

  it('should emit submitEvent with correct data when form is valid', () => {
    jest.spyOn(component.submitEvent, 'emit');

    const projectName = 'New Project';
    const projectDescription = 'New Description';

    component.projectForm.controls['projectName'].setValue(projectName);
    component.projectForm.controls['projectDescription'].setValue(projectDescription);

    component.onSubmit();

    expect(component.submitEvent.emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: projectName,
        description: projectDescription,
        status: '',
        owner: '',
        members: [],
        startDate: expect.any(Date),
        createdBy: '',
      })
    );
  });

  it('should not emit submitEvent when projectDescription is missing', () => {
    jest.spyOn(component.submitEvent, 'emit');
    component.projectForm.controls['projectName'].setValue('Project Name');
    component.projectForm.controls['projectDescription'].setValue('');
    component.onSubmit();
    expect(component.submitEvent.emit).not.toHaveBeenCalled();
  });
});