import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MindMapComponent } from './mind-map.component';

describe('MindMapComponent', () => {
  let component: MindMapComponent;
  let fixture: ComponentFixture<MindMapComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MindMapComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MindMapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should generate nodes for tasks', () => {
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
    component.projectId = 'project-1';
    component.ngOnInit();

    const taskNodes = component.nodes().filter(n => n.type === 'task');
    expect(taskNodes.length).toBe(1);
  });

  it('should generate nodes for risks', () => {
    const mockRisks = [
      {
        id: '1',
        projectId: 'project-1',
        description: 'Test Risk',
        impact: 'HIGH' as const,
        likelihood: 'LIKELY' as const,
        status: 'OPEN' as const,
        createdBy: 'admin',
        createdAt: new Date(),
      },
    ];

    component.risks = mockRisks;
    component.projectId = 'project-1';
    component.ngOnInit();

    const riskNodes = component.nodes().filter(n => n.type === 'risk');
    expect(riskNodes.length).toBe(1);
  });
});
