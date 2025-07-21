import { Profile } from './profile.entity';

describe('Profile Entity', () => {

  it('should create a Profile instance with all properties', () => {
    const now = new Date();
    const profile = new Profile();
    profile.id = '1';
    profile.userId = 'user1';
    profile.profileName = 'Test User';
    profile.profilePic = 'pic.jpg';
    profile.coverPic = 'cover.jpg';
    profile.bio = 'bio';
    profile.location = 'Earth';
    profile.occupation = 'Developer';
    profile.interests = 'coding';
    profile.skills = 'TypeScript';
    profile.timeLineEvents = [{ id: 't1' } as unknown as import('../../timelines/entities/timeline.entity').Timeline];
    profile.created_at = now;
    profile.goals = [{ id: 'g1' } as unknown as import('../../goals/entities/goal.entity').Goal];
    profile.projects = [{ id: 'p1' } as unknown as import('../../projects/entities/project.entity').Project];

    expect(profile.id).toBe('1');
    expect(profile.userId).toBe('user1');
    expect(profile.profileName).toBe('Test User');
    expect(profile.profilePic).toBe('pic.jpg');
    expect(profile.coverPic).toBe('cover.jpg');
    expect(profile.bio).toBe('bio');
    expect(profile.location).toBe('Earth');
    expect(profile.occupation).toBe('Developer');
    expect(profile.interests).toBe('coding');
    expect(profile.skills).toBe('TypeScript');
    expect(profile.timeLineEvents).toEqual([{ id: 't1' }]);
    expect(profile.created_at).toBe(now);
    expect(profile.goals).toEqual([{ id: 'g1' }]);
    expect(profile.projects).toEqual([{ id: 'p1' }]);
  });

  it('should have undefined for all properties by default except created_at', () => {
    const profile = new Profile();
    expect(profile.id).toBeUndefined();
    expect(profile.userId).toBeUndefined();
    expect(profile.profileName).toBeUndefined();
    expect(profile.profilePic).toBeUndefined();
    expect(profile.coverPic).toBeUndefined();
    expect(profile.bio).toBeUndefined();
    expect(profile.location).toBeUndefined();
    expect(profile.occupation).toBeUndefined();
    expect(profile.interests).toBeUndefined();
    expect(profile.skills).toBeUndefined();
    expect(profile.timeLineEvents).toBeUndefined();
    expect(profile.goals).toBeUndefined();
    expect(profile.projects).toBeUndefined();
    // created_at is undefined until set by DB
    expect(profile.created_at).toBeUndefined();
  });

  it('should allow setting properties to null or undefined', () => {
    const profile = new Profile();
    profile.id = undefined;
    profile.userId = null as unknown as string;
    profile.profileName = undefined;
    profile.profilePic = null as unknown as string;
    profile.coverPic = undefined;
    profile.bio = null as unknown as string;
    profile.location = undefined;
    profile.occupation = null as unknown as string;
    profile.interests = undefined;
    profile.skills = null as unknown as string;
    profile.timeLineEvents = undefined;
    profile.goals = null as unknown as import('../../goals/entities/goal.entity').Goal[];
    profile.projects = undefined;
    profile.created_at = null as unknown as Date;
    expect(profile.id).toBeUndefined();
    expect(profile.userId).toBeNull();
    expect(profile.profileName).toBeUndefined();
    expect(profile.profilePic).toBeNull();
    expect(profile.coverPic).toBeUndefined();
    expect(profile.bio).toBeNull();
    expect(profile.location).toBeUndefined();
    expect(profile.occupation).toBeNull();
    expect(profile.interests).toBeUndefined();
    expect(profile.skills).toBeNull();
    expect(profile.timeLineEvents).toBeUndefined();
    expect(profile.goals).toBeNull();
    expect(profile.projects).toBeUndefined();
    expect(profile.created_at).toBeNull();
  });

  // Decorators and relations are covered by instantiation and property assignment above.
  // If custom methods are added to Profile, add tests for them here.
});
