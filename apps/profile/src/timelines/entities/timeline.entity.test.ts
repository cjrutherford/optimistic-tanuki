import { Timeline, TimelineEventType } from './timeline.entity';

describe('Timeline Entity', () => {
  it('should create a Timeline instance with all properties', () => {
    const now = new Date();
    const timeline = new Timeline();
    timeline.id = '1';
    timeline.userId = 'user1';
    timeline.title = 'Timeline Title';
    timeline.description = 'desc';
    timeline.timeStamp = now;
    
    timeline.related_profile = null;
    timeline.eventType = TimelineEventType.Posted;

    expect(timeline).toMatchObject({
      id: '1',
      userId: 'user1',
      title: 'Timeline Title',
      description: 'desc',
      timeStamp: now,
      
      related_profile: null,
      eventType: TimelineEventType.Posted,
    });
  });

  it('should have undefined for timeStamp by default', () => {
    const timeline = new Timeline();
    expect(timeline.timeStamp).toBeUndefined();
  });
});
