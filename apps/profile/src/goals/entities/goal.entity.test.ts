import { Goal } from './goal.entity';

describe('Goal Entity', () => {
  it('should create a Goal instance with all properties', () => {
    const now = new Date();
    const goal = new Goal();
    goal.id = '1';
    goal.name = 'Test Goal';
    goal.description = 'desc';
    goal.target = 100;
    goal.progress = 0;
    goal.userId = 'user1';
    goal.startDate = now;
    goal.endDate = now;
    goal.completed = false;
    goal.timeLineEvents = [];
    goal.related_profile = null;
    goal.related_project = null;
    goal.created_at = now;

    expect(goal).toMatchObject({
      id: '1',
      name: 'Test Goal',
      description: 'desc',
      target: 100,
      progress: 0,
      userId: 'user1',
      startDate: now,
      endDate: now,
      completed: false,
      timeLineEvents: [],
      related_profile: null,
      related_project: null,
      created_at: now,
    });
  });

  it('should have undefined for completed and created_at by default', () => {
    const goal = new Goal();
    expect(goal.completed).toBeUndefined();
    expect(goal.created_at).toBeUndefined();
  });
});
