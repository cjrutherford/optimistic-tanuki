import { ModelType } from './models/model-manager.service';
import { ProjectAiService, SummarisableProject } from './project-ai.service';

/**
 * The summary is only worth having if it is about this project.
 *
 * The pilot that chose the model watched it return "t4,t5,t6" as a single
 * evidence id, and another model cite a risk id that did not exist. Neither is
 * resolvable by anything downstream, and a concern nobody can trace back to a
 * task is exactly what the citation requirement is for. So the service drops
 * them rather than passing them to a page that will render them as fact.
 */
describe('ProjectAiService', () => {
  const project: SummarisableProject = {
    id: 'p1',
    name: 'Kiln rebuild',
    tasks: [
      { id: 't1', title: 'Strip the old liner', status: 'IN_PROGRESS' },
      { id: 't2', title: 'Book the crane', status: 'TODO', assignee: null },
    ],
    risks: [{ id: 'r1', title: 'Crane availability', impact: 'HIGH' }],
  };

  function serviceReturning(summary: unknown, name = 'test-model') {
    const models = {
      getModelConfig: jest.fn(() => ({
        name,
        temperature: 0,
        baseUrl: 'http://host:11434',
      })),
      getModel: jest.fn(() => ({
        withStructuredOutput: () => ({ invoke: async () => summary }),
      })),
    };
    return {
      service: new ProjectAiService(models as never),
      models,
    };
  }

  it('keeps concerns that cite something in the project', async () => {
    const { service } = serviceReturning({
      headline: 'Behind on the crane',
      concerns: [
        { about: 'unassigned', why: 'nobody on it', evidenceId: 't2' },
        { about: 'open risk', why: 'high impact', evidenceId: 'r1' },
      ],
    });

    const result = await service.summarise(project);

    expect(result.summary?.concerns).toHaveLength(2);
    expect(result.discarded).toBe(0);
    expect(result.model).toBe('test-model');
  });

  it('drops a concern citing an id the project does not have', async () => {
    const { service } = serviceReturning({
      headline: 'Something',
      concerns: [
        { about: 'real', why: 'x', evidenceId: 't1' },
        { about: 'invented', why: 'x', evidenceId: 'r9' },
      ],
    });

    const result = await service.summarise(project);

    expect(result.summary?.concerns.map((c) => c.evidenceId)).toEqual(['t1']);
    expect(result.discarded).toBe(1);
  });

  it('drops several ids crammed into one field', async () => {
    // Observed during the pilot, more than once, from more than one model.
    const { service } = serviceReturning({
      headline: 'Something',
      concerns: [{ about: 'three at once', why: 'x', evidenceId: 't1,t2,r1' }],
    });

    const result = await service.summarise(project);

    expect(result.summary).toBeNull();
    expect(result.discarded).toBe(1);
    expect(result.unavailable).toMatch(/did not refer to anything/);
  });

  it('reports nothing rather than a headline with no concerns behind it', async () => {
    const { service } = serviceReturning({
      headline: 'Everything is fine',
      concerns: [{ about: 'x', why: 'x', evidenceId: 'nope' }],
    });

    const result = await service.summarise(project);

    // A headline alone is worth less than the computed facts the page already
    // shows, so this counts as no summary rather than a thin one.
    expect(result.summary).toBeNull();
    expect(result.unavailable).toBeTruthy();
  });

  it('says the model is missing rather than borrowing another one', async () => {
    // Falling back to the conversational model would present a summary as
    // though it came from the model chosen for this job.
    const models = {
      getModelConfig: jest.fn(() => {
        throw new Error('No model configured for project_analysis.');
      }),
      getModel: jest.fn(),
    };
    const service = new ProjectAiService(models as never);

    const result = await service.summarise(project);

    expect(result.summary).toBeNull();
    expect(result.model).toBeNull();
    expect(result.unavailable).toMatch(/No analysis model is configured/);
    expect(models.getModel).not.toHaveBeenCalled();
  });

  it('survives the model failing, and still names what it tried', async () => {
    const models = {
      getModelConfig: jest.fn(() => ({
        name: 'test-model',
        temperature: 0,
        baseUrl: 'http://host:11434',
      })),
      getModel: jest.fn(() => ({
        withStructuredOutput: () => ({
          invoke: async () => {
            throw new Error('connection refused');
          },
        }),
      })),
    };
    const service = new ProjectAiService(models as never);

    const result = await service.summarise(project);

    expect(result.summary).toBeNull();
    expect(result.model).toBe('test-model');
    expect(result.unavailable).toBeTruthy();
  });

  it('asks for the analysis model, not whichever is handy', async () => {
    const { service, models } = serviceReturning({
      headline: 'x',
      concerns: [{ about: 'x', why: 'x', evidenceId: 't1' }],
    });

    await service.summarise(project);

    expect(models.getModel).toHaveBeenCalledWith(ModelType.PROJECT_ANALYSIS);
  });

  /**
   * A real project has UUID ids, and the model inlines whatever id it is
   * citing into its prose. On the running stack that produced "Task
   * 0e5d1f75-c0b8-4830-b98f-185cbc88ee4c (strip the old liner) was due on
   * August 4th", which is not something to put in front of a reader.
   *
   * So the model is shown short labels and never a real id, and the labels are
   * mapped back on the way out. The fixture above uses t1-style ids, which
   * happen to match the labels, so these use UUIDs to actually exercise it.
   */
  describe('with real project ids', () => {
    const uuidProject: SummarisableProject = {
      id: '50295c85-9b82-43e3-8cda-aeb9ea87ff18',
      name: 'Kiln rebuild',
      tasks: [
        { id: '0e5d1f75-c0b8-4830-b98f-185cbc88ee4c', title: 'Strip liner' },
        { id: '4b696edd-3581-4264-8669-1487d85837ee', title: 'Book crane' },
      ],
      risks: [{ id: '15be4ab0-7c57-4687-a07d-907374dbd974', title: 'Crane' }],
    };

    function capturing(summary: unknown) {
      const seen: { prompt?: string } = {};
      const models = {
        getModelConfig: jest.fn(() => ({
          name: 'test-model',
          temperature: 0,
          baseUrl: 'http://host:11434',
        })),
        getModel: jest.fn(() => ({
          withStructuredOutput: () => ({
            invoke: async (messages: { content: string }[]) => {
              seen.prompt = messages.map((m) => String(m.content)).join('\n');
              return summary;
            },
          }),
        })),
      };
      return { service: new ProjectAiService(models as never), seen };
    }

    it('shows the model labels, never a real id', async () => {
      const { service, seen } = capturing({
        headline: 'x',
        concerns: [{ about: 'x', why: 'x', evidenceId: 't1' }],
      });

      await service.summarise(uuidProject);

      expect(seen.prompt).not.toContain('0e5d1f75-c0b8-4830-b98f-185cbc88ee4c');
      expect(seen.prompt).not.toContain('50295c85-9b82-43e3-8cda-aeb9ea87ff18');
      expect(seen.prompt).toContain('"t1"');
    });

    it('maps a cited label back to the real id', async () => {
      const { service } = capturing({
        headline: 'x',
        concerns: [
          { about: 'overdue', why: 'past due', evidenceId: 't1' },
          { about: 'risk', why: 'open', evidenceId: 'r1' },
        ],
      });

      const result = await service.summarise(uuidProject);

      expect(result.summary?.concerns.map((c) => c.evidenceId)).toEqual([
        '0e5d1f75-c0b8-4830-b98f-185cbc88ee4c',
        '15be4ab0-7c57-4687-a07d-907374dbd974',
      ]);
      expect(result.discarded).toBe(0);
    });

    it('drops a label that was never handed out', async () => {
      const { service } = capturing({
        headline: 'x',
        concerns: [
          { about: 'real', why: 'x', evidenceId: 't2' },
          { about: 'invented', why: 'x', evidenceId: 't9' },
        ],
      });

      const result = await service.summarise(uuidProject);

      expect(result.summary?.concerns.map((c) => c.evidenceId)).toEqual([
        '4b696edd-3581-4264-8669-1487d85837ee',
      ]);
      expect(result.discarded).toBe(1);
    });

    it('puts titles where the model wrote a label', async () => {
      // Asking it not to write ids in the prose did not work: told plainly, it
      // still returned "Task t2" and "Tasks t3 and possibly t2".
      const { service } = capturing({
        headline: 'Behind on Task t1 and t2',
        concerns: [
          {
            about: 'Task t2',
            why: 'Tasks t2 and possibly t1 are unassigned',
            evidenceId: 't2',
          },
        ],
      });

      const result = await service.summarise(uuidProject);

      expect(result.summary?.headline).toBe(
        'Behind on Strip liner and Book crane'
      );
      expect(result.summary?.concerns[0].about).toBe('Book crane');
      expect(result.summary?.concerns[0].why).toContain('Book crane');
      expect(result.summary?.concerns[0].why).not.toMatch(/\bt[0-9]\b/);
    });

    it('does not name the same thing twice', async () => {
      // The model writes "Task t2 (Book the crane)", so substituting the label
      // for the title leaves the title in twice.
      const { service } = capturing({
        headline: 'x',
        concerns: [
          // Quoted, which is what the model actually produced on the running
          // stack: "Task 't2' (Book the crane for lift-in)". The first version
          // of the collapse missed it because the quotes broke the match, and
          // the check verifying the fix used the same wrong pattern, so it
          // agreed with itself.
          {
            about: "Task 't2' (Book crane) is late",
            why: 'x',
            evidenceId: 't2',
          },
        ],
      });

      const result = await service.summarise(uuidProject);

      expect(result.summary?.concerns[0].about).toBe('Task Book crane is late');
      expect(result.summary?.concerns[0].about).not.toMatch(/\(/);
    });
  });
});
