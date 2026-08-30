import { of } from 'rxjs';
import { ProjectCommands } from '@optimistic-tanuki/constants';
import { ProjectPlanningController } from './project-planning.controller';

/**
 * Who you are comes from the session, never from the request body.
 *
 * Three advertised features could not be used because of how this was wired.
 * The gateway set createdBy on every create route, but the journal service
 * reads profileId, the risk service reads riskOwner and the change service
 * reads requestor. None of them saw an identity unless the client sent one,
 * and the journal and change tables did not, so writing a journal entry or
 * recording a change from the app was impossible.
 *
 * The reverse held for projects. owner came straight through the body, so a
 * caller could create a project owned by somebody else and drop it into their
 * workspace.
 */
describe('identity on the create routes', () => {
  const profileId = 'my-profile';
  const user = { profileId, userId: 'u1' } as never;
  const IMPOSTOR = 'somebody-else';

  function controllerWith() {
    const sent: { cmd: string; payload: Record<string, unknown> }[] = [];
    const projectPlanning = {
      send: jest.fn((pattern: { cmd: string }, payload) => {
        sent.push({ cmd: pattern.cmd, payload });
        return of({ id: 'made' });
      }),
    };
    return {
      controller: new ProjectPlanningController(
        projectPlanning as never,
        { send: jest.fn(() => of({})) } as never
      ),
      sent,
    };
  }

  /**
   * Each create route, the field the service behind it actually reads, and a
   * body to send it.
   */
  const routes: {
    what: string;
    field: string;
    call: (
      c: ProjectPlanningController,
      body: Record<string, unknown>
    ) => Promise<unknown>;
    body: Record<string, unknown>;
  }[] = [
    {
      what: 'a journal entry',
      field: 'profileId',
      call: (c, body) => c.createJournal(user, body as never),
      body: { projectId: 'p1', content: 'what happened' },
    },
    {
      what: 'a risk',
      field: 'riskOwner',
      call: (c, body) => c.createRisk(user, body as never),
      body: { projectId: 'p1', description: 'what could go wrong' },
    },
    {
      what: 'a change',
      field: 'requestor',
      call: (c, body) => c.createChange(user, body as never),
      body: { projectId: 'p1', changeDescription: 'what we changed' },
    },
    {
      what: 'a task',
      field: 'createdBy',
      call: (c, body) => c.createTask(user, body as never),
      body: { projectId: 'p1', title: 'do the thing' },
    },
    {
      what: 'a task note',
      field: 'profileId',
      call: (c, body) => c.createTaskNote(user, body as never),
      body: { taskId: 't1', content: 'a note' },
    },
  ];

  it.each(routes)(
    'creating $what fills in $field, which is the field its service reads',
    async ({ call, body, field }) => {
      const { controller, sent } = controllerWith();

      await call(controller, body);

      expect(sent[0].payload[field]).toBe(profileId);
    }
  );

  it.each(routes)(
    'creating $what ignores a $field the caller supplied',
    async ({ call, body, field }) => {
      // Sending one used to be required. It must not now be a way to act as
      // somebody else.
      const { controller, sent } = controllerWith();

      await call(controller, { ...body, [field]: IMPOSTOR });

      expect(sent[0].payload[field]).toBe(profileId);
    }
  );

  describe('a project', () => {
    it('is owned by whoever created it', async () => {
      const { controller, sent } = controllerWith();

      await controller.createProject(user, {
        name: 'Mine',
        description: 'a project of my own',
      } as never);

      expect(sent[0].cmd).toBe(ProjectCommands.CREATE);
      expect(sent[0].payload).toMatchObject({
        owner: profileId,
        createdBy: profileId,
      });
    });

    it("cannot be created in somebody else's name", async () => {
      // owner came straight from the body, so this put a project into a
      // stranger's workspace and out of the creator's.
      const { controller, sent } = controllerWith();

      await controller.createProject(user, {
        name: 'Theirs',
        description: 'a project of my own',
        owner: IMPOSTOR,
        createdBy: IMPOSTOR,
      } as never);

      expect(sent[0].payload).toMatchObject({
        owner: profileId,
        createdBy: profileId,
      });
    });
  });
});
