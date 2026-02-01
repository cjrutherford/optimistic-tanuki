import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { Component, EventEmitter, Input, Output, signal, OnInit, inject } from '@angular/core';
import {
  CreateProfileDto,
  ProfileDto,
  Task,
  TaskTag,
  UpdateProfileDto,
} from '@optimistic-tanuki/ui-models';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import { TagSelectorComponent } from '../tag-selector/tag-selector.component';

@Component({
  selector: 'lib-task-form',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    TextInputComponent,
    TextAreaComponent,
    ButtonComponent,
    SelectComponent,
    TagSelectorComponent,
  ],
  templateUrl: './task-form.component.html',
  styleUrl: './task-form.component.scss',
})
export class TaskFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);

  @Input() task: Task | null = null;
  @Input() availableTags: TaskTag[] = [];
  isEditing = signal<boolean>(false);
  @Output() formSubmit: EventEmitter<Task> = new EventEmitter<Task>();

  selectedTagIds: string[] = [];
  statusOptions = [
    { value: 'TODO', label: 'To Do' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'DONE', label: 'Done' },
    { value: 'ARCHIVED', label: 'Archived' },
  ];
  priorityOptions = [
    { value: 'LOW', label: 'Low' },
    { value: 'MEDIUM_LOW', label: 'Medium Low' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'MEDIUM_HIGH', label: 'Medium High' },
    { value: 'HIGH', label: 'High' },
  ];
  taskForm: FormGroup;
  constructor() {
    this.taskForm = this.fb.group({
      title: this.fb.control(''),
      description: this.fb.control(''),
      status: this.fb.control('TODO'),
      priority: this.fb.control('MEDIUM'),
    });
  }

  ngOnInit() {
    if (this.task) {
      this.isEditing.set(true);
      this.taskForm.patchValue({
        title: this.task.title,
        description: this.task.description,
        status: this.task.status,
        priority: this.task.priority,
      });
      // Set selected tags
      this.selectedTagIds = this.task.tags?.map(tag => tag.id) || [];
    } else {
      this.isEditing.set(false);
    }
    this.taskForm.valueChanges.subscribe((value) => {
      console.log('Form value changed:', value);
    });
  }

  selectChange(event: any, field: string) {
    this.taskForm.patchValue({ [field]: event.target.value });
  }

  onTagSelectionChange(tagIds: string[]) {
    this.selectedTagIds = tagIds;
  }

  onSubmit() {
    if (this.taskForm.valid) {

      // Get the selected tags objects
      const selectedTags = this.availableTags.filter(tag =>
        this.selectedTagIds.includes(tag.id)
      );

      const emittedValue: Task = {
        ...this.taskForm.value,
        id: this.task ? this.task.id : '',
        projectId: this.task ? this.task.projectId : '',
        createdBy: this.task ? this.task.createdBy : '',
        createdAt: this.task ? this.task.createdAt : new Date(),
        updatedAt: new Date(),
        tags: selectedTags,
      };
      this.formSubmit.emit(emittedValue);
      this.taskForm.reset();
      this.selectedTagIds = [];
    }
  }
}
