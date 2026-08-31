import { of, throwError } from 'rxjs';

import { PersonaVoiceService, asList } from './persona-voice.service';

/**
 * Who the assistant is, and the one rule that keeps a persona from undoing
 * work that took three attempts to get right.
 *
 * The seeded records were written when these personas answered questions
 * rather than acted on a project. Their promptTemplate and exampleResponses
 * are instructions to hand out templates and offer further analysis, which is
 * the exact behaviour the agent's rules exist to prevent. So this reads who
 * they are and refuses to read what they should do.
 */
describe('PersonaVoiceService', () => {
  const patricia = {
    id: 'persona-1',
    name: 'Patricia P. Project',
    description: 'Project Manager: works on your projects with you.',
    strengths: ['Organized', 'Empathetic', 'Decisive'],
    interests: ['Team collaboration', 'Agile methodologies'],
    coreObjective: 'Provide project management assistance',
    goals: ['Manage projects'],
    objectives: ['Help users manage their projects effectively'],
    limitations: ['Advice is general, not project-specific'],
    exampleResponses: ["Here's a template for your project plan."],
    promptTemplate: 'You are a project manager. Refer to Technical Lead.',
  };

  function serviceWith(reply: unknown) {
    const send = jest.fn(() => of(reply));
    const service = new PersonaVoiceService({ send } as never);
    return { service, send };
  }

  it('speaks as the persona that was asked for', async () => {
    const { service, send } = serviceWith(patricia);

    const voice = await service.voiceFor('persona-1');

    expect(voice?.name).toBe('Patricia P. Project');
    expect(send).toHaveBeenCalledWith(expect.anything(), { id: 'persona-1' });
  });

  it('takes the one whose job is projects when none was chosen', async () => {
    // By what a persona is for, not by a hardcoded id that would differ per
    // environment, and not by a name that breaks the moment somebody edits it.
    const { service } = serviceWith([
      { id: 'p9', name: 'Percy Verse', coreObjective: 'Assist with poetry' },
      patricia,
    ]);

    const voice = await service.voiceFor(null);

    expect(voice?.id).toBe('persona-1');
  });

  describe('identity, never behaviour', () => {
    it('says who they are and what they are like', async () => {
      const { service } = serviceWith(patricia);

      const lines = (await service.voiceFor('persona-1'))?.identityLines.join(
        '\n'
      );

      expect(lines).toContain('You are Patricia P. Project.');
      expect(lines).toContain('organized, empathetic and decisive');
    });

    it('refuses the fields that tell it how to answer', async () => {
      // Every one of these is an instruction, and every one of them points at
      // describing and offering rather than answering.
      const { service } = serviceWith(patricia);

      const lines = (await service.voiceFor('persona-1'))?.identityLines.join(
        '\n'
      );

      expect(lines).not.toContain("Here's a template");
      expect(lines).not.toContain('Refer to Technical Lead');
      expect(lines).not.toContain('Advice is general');
      expect(lines).not.toContain('Manage projects');
    });
  });

  describe('when there is no persona to be had', () => {
    it('speaks as nobody when the telos service is unreachable', async () => {
      // A nameless assistant that answers beats a named one that cannot.
      const send = jest.fn(() => throwError(() => new Error('unreachable')));
      const service = new PersonaVoiceService({ send } as never);

      await expect(service.voiceFor('persona-1')).resolves.toBeNull();
    });

    it('speaks as nobody when the id matches nothing', async () => {
      const { service } = serviceWith(null);

      await expect(service.voiceFor('gone')).resolves.toBeNull();
    });

    it('speaks as nobody when no seeded persona does project work', async () => {
      const { service } = serviceWith([
        { id: 'p9', name: 'Percy Verse', coreObjective: 'Assist with poetry' },
      ]);

      await expect(service.voiceFor(null)).resolves.toBeNull();
    });
  });

  it('asks once and remembers, because a run already costs a minute', async () => {
    const { service, send } = serviceWith(patricia);

    await service.voiceFor('persona-1');
    await service.voiceFor('persona-1');

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('starts with every tool, and says so in a way a caller can read', async () => {
    // Null rather than a list of everything, so "unscoped" stays distinct from
    // "scoped to whatever existed when this was written".
    const { service } = serviceWith(patricia);

    expect((await service.voiceFor('persona-1'))?.tools).toBeNull();
  });

  describe('asList', () => {
    it('reads as a sentence rather than a field dump', () => {
      expect(asList(['a', 'b', 'c'])).toBe('a, b and c');
      expect(asList(['only'])).toBe('only');
      expect(asList([])).toBe('');
    });
  });
});
