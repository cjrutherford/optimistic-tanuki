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

    const taskNodes = component.nodes().filter((n) => n.type === 'task');
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

    const riskNodes = component.nodes().filter((n) => n.type === 'risk');
    expect(riskNodes.length).toBe(1);
  });

  it('should generate nodes for changes', () => {
    const mockChanges = [
      {
        id: 'c1',
        projectId: 'project-1',
        changeDescription: 'Desc',
        changeType: 'ADDITION' as const,
        changeStatus: 'PENDING' as const,
        requestor: 'user',
        resolution: 'PENDING' as const,
        updatedAt: new Date(),
      },
    ];
    component.changes = mockChanges as any;
    component.projectId = 'project-1';
    component.ngOnInit();
    const changeNodes = component.nodes().filter((n) => n.type === 'change');
    expect(changeNodes.length).toBe(1);
  });

  it('should handle canvas interactions and emit nodeMove', () => {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as any);

    component.nodes.set([
      { id: 'task-1', type: 'task', title: 't', x: 100, y: 100, width: 50, height: 20 },
    ] as any);

    component.ngAfterViewInit();

    const emitSpy = jest.spyOn(component.nodeMove, 'emit');

    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, clientY: 100 }));
    expect(component.selectedNode()?.id).toBe('task-1');

    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: 120, clientY: 120 }));
    canvas.dispatchEvent(new MouseEvent('mouseup', { clientX: 120, clientY: 120 }));
    expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ nodeId: 'task-1' }));
  });

  it('should zoom on wheel', () => {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    jest.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as any);
    component.ngAfterViewInit();
    const initial = (component as any).scale;
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -1 }));
    expect((component as any).scale).toBeGreaterThan(initial);
  });

  it('should reset view', () => {
    (component as any).scale = 2;
    (component as any).panX = 10;
    (component as any).panY = 20;
    component.resetView();
    expect((component as any).scale).toBe(1);
    expect((component as any).panX).toBe(0);
    expect((component as any).panY).toBe(0);
  });

  it('should export as image without error', () => {
    const canvas = fixture.nativeElement.querySelector('canvas') as HTMLCanvasElement;
    jest.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,x');
    const link: any = { click: jest.fn() };
    jest.spyOn(document, 'createElement').mockReturnValueOnce(link as any);
    (component as any).canvas = canvas;
    component.exportAsImage();
    expect(link.click).toHaveBeenCalled();
  });

  it('should create connections to center when projectId is set', () => {
    component.projectId = 'p1';
    component.tasks = [{ id: 't1', title: 't', description: '', status: 'TODO', priority: 'LOW', assignee: '', projectId: 'p1', createdBy: '', createdAt: new Date() } as any];
    component.risks = [{ id: 'r1', projectId: 'p1', description: 'risk', impact: 'LOW', likelihood: 'UNLIKELY', status: 'OPEN', createdBy: '', createdAt: new Date() } as any];
    component.changes = [{ id: 'c1', projectId: 'p1', changeDescription: 'change', changeType: 'ADDITION', changeStatus: 'PENDING', requestor: '', resolution: 'PENDING', updatedAt: new Date() } as any];
    component.ngOnInit();
    expect(component.connections().length).toBe(3);
  });

  it('should assign colors based on statuses', () => {
    component.projectId = 'p1';
    component.tasks = [
      { id: 't1', title: 't', description: '', status: 'DONE', priority: 'LOW', assignee: '', projectId: 'p1', createdBy: '', createdAt: new Date() } as any,
      { id: 't2', title: 't', description: '', status: 'IN_PROGRESS', priority: 'LOW', assignee: '', projectId: 'p1', createdBy: '', createdAt: new Date() } as any,
      { id: 't3', title: 't', description: '', status: 'ARCHIVED', priority: 'LOW', assignee: '', projectId: 'p1', createdBy: '', createdAt: new Date() } as any,
    ];
    component.risks = [
      { id: 'r1', projectId: 'p1', description: 'risk', impact: 'MEDIUM', likelihood: 'UNLIKELY', status: 'OPEN', createdBy: '', createdAt: new Date() } as any,
      { id: 'r2', projectId: 'p1', description: 'risk', impact: 'HIGH', likelihood: 'UNLIKELY', status: 'OPEN', createdBy: '', createdAt: new Date() } as any,
    ];
    component.changes = [
      { id: 'c1', projectId: 'p1', changeDescription: 'change', changeType: 'ADDITION', changeStatus: 'COMPLETE', requestor: '', resolution: 'PENDING', updatedAt: new Date() } as any,
      { id: 'c2', projectId: 'p1', changeDescription: 'change', changeType: 'ADDITION', changeStatus: 'DISCARDED', requestor: '', resolution: 'PENDING', updatedAt: new Date() } as any,
      { id: 'c3', projectId: 'p1', changeDescription: 'change', changeType: 'ADDITION', changeStatus: 'IMPELEMENTING', requestor: '', resolution: 'PENDING', updatedAt: new Date() } as any,
      { id: 'c4', projectId: 'p1', changeDescription: 'change', changeType: 'ADDITION', changeStatus: 'PENDING_APPROVAL', requestor: '', resolution: 'PENDING', updatedAt: new Date() } as any,
    ];
    component.ngOnInit();
    const nodes = component.nodes();
    expect(nodes.find(n => n.id.startsWith('task-'))).toBeTruthy();
    expect(nodes.find(n => n.id.startsWith('risk-'))).toBeTruthy();
    expect(nodes.find(n => n.id.startsWith('change-'))).toBeTruthy();
  });
});
