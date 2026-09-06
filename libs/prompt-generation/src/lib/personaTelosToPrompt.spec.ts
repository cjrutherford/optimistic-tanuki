import {
  PersonaTelosDto,
  ProfileTelosDto,
  ProjectTelosDto,
} from '@optimistic-tanuki/models';
import {
  generatePersonaSystemMessage,
  personaTelosPrompt,
} from './personaTelosToPrompt';

describe('personaTelosToPrompt', () => {
  const persona: PersonaTelosDto = {
    id: 'persona-1',
    name: 'Ada',
    description: 'expert programmer',
    goals: ['teach', 'assist'],
    skills: ['typescript', 'testing'],
    interests: [],
    limitations: ['no internet access'],
    strengths: [],
    objectives: [],
    coreObjective: 'help the user succeed',
    exampleResponses: [],
    promptTemplate: '',
  };

  const userProfile: ProfileTelosDto = {
    id: 'profile-1',
    name: 'Grace',
    projects: [],
    description: '',
    goals: ['ship software'],
    skills: ['leadership'],
    interests: [],
    limitations: [],
    strengths: [],
    objectives: [],
    coreObjective: 'deliver value',
    overallProfileSummary: '',
  };

  const project = {
    id: 'project-1',
    profile: undefined,
    name: 'Compiler',
    description: '',
    goals: ['build a compiler'],
    skills: [],
    interests: [],
    limitations: [],
    strengths: [],
    objectives: [],
    coreObjective: 'produce machine code',
    overallProjectSummary: '',
  } as unknown as ProjectTelosDto;

  describe('generatePersonaSystemMessage', () => {
    it('includes persona details when neither profile nor project are provided', () => {
      const message = generatePersonaSystemMessage(persona);

      expect(message).toContain('You are Ada who is a(n) expert programmer');
      expect(message).toContain('Goals: teach, assist');
      expect(message).toContain('Skills: typescript, testing');
      expect(message).toContain('Limitations: no internet access');
      expect(message).toContain(
        'Your core objective is help the user succeed.'
      );
      expect(message).not.toContain("User's telos");
      expect(message).not.toContain("Project's telos");
    });

    it('includes the user profile section when provided', () => {
      const message = generatePersonaSystemMessage(persona, userProfile);

      expect(message).toContain(
        "User's telos (who is interested in the response):"
      );
      expect(message).toContain(`User's name is Grace.`);
      expect(message).not.toContain("Project's telos");
    });

    it('includes the project section when provided', () => {
      const message = generatePersonaSystemMessage(persona, undefined, project);

      expect(message).toContain(
        "Project's telos (the current project): Compiler): Project's name is Compiler."
      );
      expect(message).not.toContain("User's telos");
    });

    it('includes both sections when both are provided', () => {
      const message = generatePersonaSystemMessage(
        persona,
        userProfile,
        project
      );

      expect(message).toContain("User's telos");
      expect(message).toContain("Project's telos");
    });
  });

  describe('personaTelosPrompt', () => {
    it('builds a GeneratePrompt with a single system message', () => {
      const prompt = personaTelosPrompt(persona, 'gpt-4');

      expect(prompt.model).toBe('gpt-4');
      expect(prompt.messages).toHaveLength(1);
      expect(prompt.messages[0].role).toBe('system');
      expect(prompt.messages[0].content).toContain('You are Ada');
    });

    it('merges additional options onto the prompt', () => {
      const prompt = personaTelosPrompt(
        persona,
        'gpt-4',
        undefined,
        undefined,
        {
          temperature: 0.5,
        } as any
      );

      expect((prompt as any).temperature).toBe(0.5);
    });

    it('passes the user profile and project through to the system message', () => {
      const prompt = personaTelosPrompt(persona, 'gpt-4', userProfile, project);

      expect(prompt.messages[0].content).toContain("User's telos");
      expect(prompt.messages[0].content).toContain("Project's telos");
    });
  });
});
