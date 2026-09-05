import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { PersonaTelosCommands } from '@optimistic-tanuki/constants';
import { PersonaMcpService } from './persona-mcp.service';

/**
 * Exercises the persona MCP tools: the query each sends to TELOS-docs, the
 * projection it returns, the scoring in find_specialist_persona, the referral
 * message it composes, and how downstream failures surface.
 */
describe('PersonaMcpService tools', () => {
  let service: PersonaMcpService;
  let telosDocs: { send: jest.Mock };

  const lastPattern = () => telosDocs.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => telosDocs.send.mock.calls.at(-1)?.[1];

  const persona = (over: Record<string, unknown> = {}) => ({
    id: 'p-1',
    name: 'Rita',
    description: 'React specialist',
    skills: ['react', 'typescript'],
    expertise: ['frontend'],
    specialty: 'react',
    goals: ['ship ui'],
    strengths: ['components'],
    limitations: ['no backend'],
    ...over,
  });

  beforeEach(() => {
    telosDocs = { send: jest.fn().mockReturnValue(of([])) };
    service = new PersonaMcpService(telosDocs as unknown as ClientProxy);

    // Silence the per-instance logger rather than the console.
    (
      service as unknown as { logger: { log: jest.Mock; error: jest.Mock } }
    ).logger = { log: jest.fn(), error: jest.fn() } as never;
  });

  describe('list_ai_personas', () => {
    it('sends an empty query and projects the summary fields', async () => {
      telosDocs.send.mockReturnValue(of([persona()]));

      const result = await service.listAiPersonas({});

      expect(lastPattern()).toEqual({ cmd: PersonaTelosCommands.FIND });
      expect(lastPayload()).toEqual({});
      expect(result).toEqual({
        success: true,
        personas: [
          {
            id: 'p-1',
            name: 'Rita',
            description: 'React specialist',
            skills: ['react', 'typescript'],
            expertise: ['frontend'],
            specialty: 'react',
          },
        ],
        count: 1,
      });
      // The summary projection deliberately drops the long-form fields.
      expect(result.personas[0]).not.toHaveProperty('goals');
    });

    it('passes a specialty filter through as the query', async () => {
      telosDocs.send.mockReturnValue(of([]));

      const result = await service.listAiPersonas({ specialty: 'risk' });

      expect(lastPayload()).toEqual({ specialty: 'risk' });
      expect(result).toEqual({ success: true, personas: [], count: 0 });
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      telosDocs.send.mockReturnValue(
        throwError(() => new Error('telos offline'))
      );

      await expect(service.listAiPersonas({})).rejects.toThrow(
        'Failed to list AI personas: telos offline'
      );
    });
  });

  describe('get_ai_persona', () => {
    it('looks a persona up by id and returns the full detail projection', async () => {
      telosDocs.send.mockReturnValue(of([persona()]));

      const result = await service.getAiPersona({ personaId: 'p-1' });

      expect(lastPattern()).toEqual({ cmd: PersonaTelosCommands.FIND });
      expect(lastPayload()).toEqual({ id: 'p-1' });
      expect(result).toEqual({
        success: true,
        persona: {
          id: 'p-1',
          name: 'Rita',
          description: 'React specialist',
          skills: ['react', 'typescript'],
          expertise: ['frontend'],
          specialty: 'react',
          goals: ['ship ui'],
          strengths: ['components'],
          limitations: ['no backend'],
        },
      });
    });

    it('looks a persona up by name', async () => {
      telosDocs.send.mockReturnValue(of([persona()]));

      await service.getAiPersona({ personaName: 'Rita' });

      expect(lastPayload()).toEqual({ name: 'Rita' });
    });

    it('queries on both id and name when both are given', async () => {
      telosDocs.send.mockReturnValue(of([persona()]));

      await service.getAiPersona({ personaId: 'p-1', personaName: 'Rita' });

      expect(lastPayload()).toEqual({ id: 'p-1', name: 'Rita' });
    });

    it('rejects a call with neither id nor name before querying', async () => {
      await expect(service.getAiPersona({})).rejects.toThrow(
        'Failed to get AI persona: Either personaId or personaName must be provided'
      );
      expect(telosDocs.send).not.toHaveBeenCalled();
    });

    it('reports a not-found persona when the query comes back empty', async () => {
      telosDocs.send.mockReturnValue(of([]));

      await expect(
        service.getAiPersona({ personaId: 'missing' })
      ).rejects.toThrow('Failed to get AI persona: Persona not found');
    });

    it('reports a not-found persona when the query comes back null', async () => {
      telosDocs.send.mockReturnValue(of(null));

      await expect(
        service.getAiPersona({ personaId: 'missing' })
      ).rejects.toThrow('Failed to get AI persona: Persona not found');
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      telosDocs.send.mockReturnValue(
        throwError(() => new Error('telos offline'))
      );

      await expect(service.getAiPersona({ personaId: 'p-1' })).rejects.toThrow(
        'Failed to get AI persona: telos offline'
      );
    });
  });

  describe('find_specialist_persona', () => {
    it('fetches every persona and scores a specialty mentioned in the requirement', async () => {
      telosDocs.send.mockReturnValue(
        of([
          persona({ id: 'p-1', specialty: 'react' }),
          persona({
            id: 'p-2',
            name: 'Sam',
            specialty: 'accounting',
            description: 'ledgers',
            skills: ['excel'],
            expertise: ['finance'],
          }),
        ])
      );

      const result = await service.findSpecialistPersona({
        requirement: 'I need help with react development',
      });

      expect(lastPattern()).toEqual({ cmd: PersonaTelosCommands.FIND });
      expect(lastPayload()).toEqual({});
      expect(result.success).toBe(true);
      expect(result.requirement).toBe('I need help with react development');
      // Only the specialty match scores; the unmatched persona is filtered out.
      expect(result.recommendedPersonas).toEqual([
        {
          id: 'p-1',
          name: 'Rita',
          description: 'React specialist',
          specialty: 'react',
          skills: ['react', 'typescript'],
          matchScore: 10,
        },
      ]);
      expect(result.message).toBe(
        'Found 1 specialist(s) who can help with this requirement'
      );
    });

    it('adds 3 per matching skill and 2 per matching expertise entry', async () => {
      telosDocs.send.mockReturnValue(
        of([
          persona({
            specialty: undefined,
            description: 'builds interfaces',
            skills: ['React', 'TypeScript'],
            expertise: ['react ecosystem'],
          }),
        ])
      );

      const result = await service.findSpecialistPersona({
        requirement: 'front end work',
        skillsNeeded: ['react'],
      });

      // 3 for the skill match (case-insensitive, substring either way) plus 2
      // for the expertise entry containing the skill.
      expect(result.recommendedPersonas[0].matchScore).toBe(5);
    });

    it('adds 5 when the requirement contains the persona description verbatim', async () => {
      telosDocs.send.mockReturnValue(
        of([
          persona({
            specialty: undefined,
            description: 'react specialist',
            skills: [],
            expertise: [],
          }),
        ])
      );

      const result = await service.findSpecialistPersona({
        requirement: 'looking for a react specialist please',
      });

      expect(result.recommendedPersonas[0].matchScore).toBe(5);
    });

    it('returns the top three matches ordered by descending score', async () => {
      telosDocs.send.mockReturnValue(
        of([
          persona({ id: 'low', specialty: undefined, skills: ['react'] }),
          persona({ id: 'high', specialty: 'react', skills: ['react'] }),
          persona({ id: 'mid', specialty: undefined, skills: ['react', 'ui'] }),
          persona({ id: 'also-low', specialty: undefined, skills: ['react'] }),
          persona({
            id: 'zero',
            specialty: undefined,
            skills: [],
            expertise: [],
          }),
        ])
      );

      const result = await service.findSpecialistPersona({
        requirement: 'need react and ui help',
        skillsNeeded: ['react', 'ui'],
      });

      expect(result.recommendedPersonas).toHaveLength(3);
      expect(result.recommendedPersonas[0].id).toBe('high');
      const scores = result.recommendedPersonas.map((p) => p.matchScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('says so when nothing scores above zero', async () => {
      telosDocs.send.mockReturnValue(
        of([
          persona({
            specialty: 'accounting',
            description: 'ledgers',
            skills: ['excel'],
            expertise: ['finance'],
          }),
        ])
      );

      const result = await service.findSpecialistPersona({
        requirement: 'help me with react',
      });

      expect(result.recommendedPersonas).toEqual([]);
      expect(result.message).toBe(
        'No specialists found matching this requirement'
      );
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      telosDocs.send.mockReturnValue(
        throwError(() => new Error('telos offline'))
      );

      await expect(
        service.findSpecialistPersona({ requirement: 'anything' })
      ).rejects.toThrow('Failed to find specialist persona: telos offline');
    });
  });

  describe('refer_to_persona', () => {
    it('looks the persona up by id and composes the full referral message', async () => {
      telosDocs.send.mockReturnValue(of([persona()]));

      const result = await service.referToPersona({
        personaId: 'p-1',
        reason: 'they know React best',
        userQuery: 'how do I memoize this?',
      });

      expect(lastPattern()).toEqual({ cmd: PersonaTelosCommands.FIND });
      expect(lastPayload()).toEqual({ id: 'p-1' });
      expect(result.success).toBe(true);
      expect(result.persona).toEqual({
        id: 'p-1',
        name: 'Rita',
        specialty: 'react',
      });
      expect(result.referralMessage).toContain('**Rita**');
      expect(result.referralMessage).toContain('who specializes in react');
      expect(result.referralMessage).toContain('they know React best');
      expect(result.referralMessage).toContain('**About Rita:**');
      expect(result.referralMessage).toContain(
        '**Expertise:** react, typescript'
      );
      expect(result.referralMessage).toContain('"how do I memoize this?"');
      expect(result.referralMessage).toContain(
        'Would you like me to connect you with Rita?'
      );
    });

    it('falls back to "this area" and omits the optional sections', async () => {
      telosDocs.send.mockReturnValue(
        of([persona({ specialty: undefined, skills: [] })])
      );

      const result = await service.referToPersona({
        personaId: 'p-1',
        reason: 'better fit',
      });

      expect(result.referralMessage).toContain('who specializes in this area');
      expect(result.referralMessage).not.toContain('**Expertise:**');
      expect(result.referralMessage).not.toContain(
        'context about your request'
      );
      expect(result.persona.specialty).toBeUndefined();
    });

    it('reports a not-found persona when the lookup comes back empty', async () => {
      telosDocs.send.mockReturnValue(of([]));

      await expect(
        service.referToPersona({ personaId: 'missing', reason: 'why not' })
      ).rejects.toThrow('Failed to create referral: Persona not found');
    });

    it('wraps a downstream failure in a tool-level error', async () => {
      telosDocs.send.mockReturnValue(
        throwError(() => new Error('telos offline'))
      );

      await expect(
        service.referToPersona({ personaId: 'p-1', reason: 'why not' })
      ).rejects.toThrow('Failed to create referral: telos offline');
    });
  });
});
