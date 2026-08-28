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
});
