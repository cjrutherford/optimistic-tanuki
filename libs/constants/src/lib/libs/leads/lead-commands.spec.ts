import { LeadCommands } from './lead-commands';

describe('LeadCommands', () => {
  it('should have correct FIND_ALL command', () => {
    expect(LeadCommands.FIND_ALL).toBe('lead.findAll');
  });

  it('should have correct FIND_ONE command', () => {
    expect(LeadCommands.FIND_ONE).toBe('lead.findOne');
  });

  it('should have correct CREATE command', () => {
    expect(LeadCommands.CREATE).toBe('lead.create');
  });

  it('should have correct UPDATE command', () => {
    expect(LeadCommands.UPDATE).toBe('lead.update');
  });

  it('should have correct DELETE command', () => {
    expect(LeadCommands.DELETE).toBe('lead.delete');
  });

  it('should have correct GET_STATS command', () => {
    expect(LeadCommands.GET_STATS).toBe('lead.getStats');
  });

  it('should have correct SEARCH command', () => {
    expect(LeadCommands.SEARCH).toBe('lead.search');
  });
});
