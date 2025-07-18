import { Project } from './project.entity';

describe('Project Entity', () => {
  it('should create a Project instance with all properties', () => {
    const now = new Date();
    const project = new Project();
    project.id = '1';
    project.name = 'Test Project';
    project.description = 'desc';
    project.userId = 'user1';
    project.related_profile = null;
    project.timeLineEvents = [];
    project.goals = [];
    project.created_at = now;

    expect(project).toMatchObject({
      id: '1',
      name: 'Test Project',
      description: 'desc',
      userId: 'user1',
      related_profile: null,
      timeLineEvents: [],
      goals: [],
      created_at: now,
    });
  });

  it('should have undefined for created_at by default', () => {
    const project = new Project();
    expect(project.created_at).toBeUndefined();
  });
});
