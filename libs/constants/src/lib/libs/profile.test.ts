import {
    ProfileCommands,
    ProjectCommands,
    GoalCommands,
    TimelineCommands
} from './profile';

describe('ProfileCommands', () => {
    it("Should Have a Create command", () => {
        expect(ProfileCommands.Create).toBe('Create:Profile');
    });
    
    it("Should Have a Update command", () => {
        expect(ProfileCommands.Update).toBe('Update:Profile');
    });

    it("Should Have a Delete command", () => {
        expect(ProfileCommands.Delete).toBe('Delete:Profile');
    });

    it("Should Have a Get command", () => {
        expect(ProfileCommands.Get).toBe('Get:Profile');
    });

    it("Should Have a GetAll command", () => {
        expect(ProfileCommands.GetAll).toBe('GetAll:Profile');
    });
});

describe('ProjectCommands', () => {
    it("Should Have a Create command", () => {
        expect(ProjectCommands.Create).toBe('Create:Project');
    });
    
    it("Should Have a Update command", () => {
        expect(ProjectCommands.Update).toBe('Update:Project');
    });

    it("Should Have a Delete command", () => {
        expect(ProjectCommands.Delete).toBe('Delete:Project');
    });

    it("Should Have a Get command", () => {
        expect(ProjectCommands.Get).toBe('Get:Project');
    });

    it("Should Have a GetAll command", () => {
        expect(ProjectCommands.GetAll).toBe('GetAll:Project');
    });
});

describe('GoalCommands', () => {
    it("Should Have a Create command", () => {
        expect(GoalCommands.Create).toBe('Create:Goal');
    });
    
    it("Should Have a Update command", () => {
        expect(GoalCommands.Update).toBe('Update:Goal');
    });

    it("Should Have a Delete command", () => {
        expect(GoalCommands.Delete).toBe('Delete:Goal');
    });

    it("Should Have a Get command", () => {
        expect(GoalCommands.Get).toBe('Get:Goal');
    });

    it("Should Have a GetAll command", () => {
        expect(GoalCommands.GetAll).toBe('GetAll:Goal');
    });
});

describe('TimelineCommands', () => {    
    it("Should Have a Create command", () => {
        expect(TimelineCommands.Create).toBe('Create:Timeline');
    });
    
    it("Should Have a Update command", () => {
        expect(TimelineCommands.Update).toBe('Update:Timeline');
    });

    it("Should Have a Delete command", () => {
        expect(TimelineCommands.Delete).toBe('Delete:Timeline');
    });

    it("Should Have a Get command", () => {
        expect(TimelineCommands.Get).toBe('Get:Timeline');
    });

    it("Should Have a GetAll command", () => {
        expect(TimelineCommands.GetAll).toBe('GetAll:Timeline');
    });
});