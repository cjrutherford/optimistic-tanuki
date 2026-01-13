import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TaskCalendarComponent } from './task-calendar.component';

describe('TaskCalendarComponent', () => {
  let component: TaskCalendarComponent;
  let fixture: ComponentFixture<TaskCalendarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TaskCalendarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TaskCalendarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have calendar options configured', () => {
    expect(component.calendarOptions).toBeDefined();
    expect(component.calendarOptions.plugins).toBeDefined();
    expect(component.calendarOptions.initialView).toBe('dayGridMonth');
  });

  it('should update calendar events when tasks change', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Test Task',
        description: 'Test Description',
        status: 'TODO' as const,
        priority: 'HIGH' as const,
        assignee: 'test@example.com',
        projectId: 'project-1',
        dueDate: new Date('2024-12-31'),
        createdBy: 'admin',
        createdAt: new Date(),
      },
    ];

    component.tasks = mockTasks;
    component.ngOnChanges({
      tasks: {
        currentValue: mockTasks,
        previousValue: [],
        firstChange: false,
        isFirstChange: () => false,
      },
    });

    expect(component.calendarOptions.events).toBeDefined();
  });
});
