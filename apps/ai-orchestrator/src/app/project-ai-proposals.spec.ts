import { ProjectAiService } from './project-ai.service';
import { ModelType } from './models/model-manager.service';

/**
 * Turning what a model wrote into changes a person can be asked to approve.
 *
 * A proposal that cannot be applied must never reach a reviewer. Approving it
 * would fail the moment they pressed the button, and the failure would look
 * like theirs rather than the model's.
 */
describe('ProjectAiService proposals', () => {
  const project = {
    id: 'p1',
    name: 'Kiln rebuild',
    tasks: [{ id: 'task-uuid', title: 'Book the crane' }],
    risks: [{ id: 'risk-uuid', title: 'Crane availability' }],
  };

  function serviceReturning(proposals: unknown[]) {
    const invoke = jest.fn().mockResolvedValue({ proposals });
    const models = {
      getModelConfig: jest.fn(() => ({ name: 'qwen3:8b' })),
      getModel: jest.fn(() => ({
        withStructuredOutput: () => ({ invoke }),
      })),
    };
    return {
      service: new ProjectAiService(models as never),
      models,
      invoke,
    };
  }

  it('uses the model chosen for producing structured arguments', async () => {
    // The pilot separated the candidates on exactly this: only one produced
    // correct arguments every pass. Reaching for a different one would be
    // presenting untested work as the tested choice.
    const { service, models } = serviceReturning([]);

    await service.proposeChanges(project);

    expect(models.getModel).toHaveBeenCalledWith(ModelType.TOOL_CALLING);
  });

  it('files each kind against the project the request was for', async () => {
    const { service } = serviceReturning([
      {
        operation: 'task.create',
        title: 'Confirm the permit',
        detail: 'The inspection needs one',
        reason: 'Nothing covers it',
      },
      {
        operation: 'risk.create',
        title: 'Weather',
        detail: 'A lift in high wind',
        reason: 'No mitigation recorded',
      },
      {
        operation: 'projectJournal.create',
        title: 'Week one',
        detail: 'What happened',
        reason: 'No entries yet',
      },
    ]);

    const result = await service.proposeChanges(project);

    expect(result.proposals.map((p) => p.operation)).toEqual([
      'task.create',
      'risk.create',
      'projectJournal.create',
    ]);
    for (const proposal of result.proposals) {
      expect(proposal.payload.projectId).toBe('p1');
    }
  });

  it('resolves a note to the real task it belongs to', async () => {
    const { service } = serviceReturning([
      {
        operation: 'taskNote.create',
        title: 'Crane note',
        detail: 'The yard closes at four',
        reason: 'Affects the booking',
        relatesTo: 't1',
      },
    ]);

    const result = await service.proposeChanges(project);

    expect(result.proposals[0].payload).toMatchObject({
      taskId: 'task-uuid',
      content: 'The yard closes at four',
    });
  });

  describe('what it refuses to put in front of a reviewer', () => {
    it('drops a note that names no task, since there is nothing to attach it to', async () => {
      const { service } = serviceReturning([
        {
          operation: 'taskNote.create',
          title: 'A note',
          detail: 'about something',
          reason: 'because',
        },
      ]);

      const result = await service.proposeChanges(project);

      expect(result.proposals).toHaveLength(0);
      expect(result.discarded).toBe(1);
    });

    it('drops a note pointing at a task the model invented', async () => {
      // The model never sees a real id, so a label it made up resolves to
      // nothing. That is what the relabelling is for.
      const { service } = serviceReturning([
        {
          operation: 'taskNote.create',
          title: 'A note',
          detail: 'about something',
          reason: 'because',
          relatesTo: 't7',
        },
      ]);

      const result = await service.proposeChanges(project);

      expect(result.proposals).toHaveLength(0);
      expect(result.discarded).toBe(1);
    });

    it('drops anything with no title, which is nothing a reviewer can read', async () => {
      const { service } = serviceReturning([
        { operation: 'task.create', title: '  ', detail: 'x', reason: 'y' },
      ]);

      expect((await service.proposeChanges(project)).proposals).toHaveLength(0);
    });
  });

  it('puts titles where the model wrote a label', async () => {
    // Same rule as the summary. A reviewer shown "t1" is no better off than
    // one shown a UUID.
    const { service } = serviceReturning([
      {
        operation: 'task.create',
        title: 'Chase the supplier',
        detail: 'Needed before t1',
        reason: 'r1 has no mitigation',
      },
    ]);

    const result = await service.proposeChanges(project);

    expect(result.proposals[0].payload.description).toBe(
      'Needed before Book the crane'
    );
    expect(result.proposals[0].reason).toBe(
      'Crane availability has no mitigation'
    );
  });

  describe('when it cannot answer', () => {
    it('says so rather than falling back to another model', async () => {
      const models = {
        getModelConfig: jest.fn(() => {
          throw new Error('No model configured for tool_calling');
        }),
        getModel: jest.fn(),
      };
      const service = new ProjectAiService(models as never);

      const result = await service.proposeChanges(project);

      expect(result.proposals).toEqual([]);
      expect(result.unavailable).toMatch(/No model is configured/);
      expect(models.getModel).not.toHaveBeenCalled();
    });

    it('returns nothing rather than throwing when the model fails', async () => {
      const { service, invoke } = serviceReturning([]);
      invoke.mockRejectedValue(new Error('connection refused'));

      const result = await service.proposeChanges(project);

      expect(result.proposals).toEqual([]);
      expect(result.unavailable).toBeTruthy();
    });
  });
});
