import { LeadCommands, LeadOutreachCommands } from './lead-commands';

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

  it('should have correct SEND_RESPONSE command', () => {
    expect(LeadCommands.SEND_RESPONSE).toBe('lead.sendResponse');
  });

  it('should have correct LOG_OUTREACH command', () => {
    expect(LeadCommands.LOG_OUTREACH).toBe('lead.logOutreach');
  });

  it('should have correct outreach draft commands', () => {
    expect(LeadOutreachCommands.GENERATE_DRAFT).toBe(
      'leads.outreach.generateDraft'
    );
    expect(LeadOutreachCommands.FIND_LATEST_DRAFT).toBe(
      'leads.outreach.findLatestDraft'
    );
  });
});
