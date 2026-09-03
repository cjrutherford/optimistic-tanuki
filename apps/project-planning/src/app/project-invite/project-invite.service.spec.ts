import { ProjectInviteService, normaliseEmail } from './project-invite.service';

/**
 * Inviting somebody, and everybody who may not.
 *
 * Deciding who is in a project is the owner's alone. A member reading a
 * project and a member changing who else can read it are different questions,
 * and only one of them is answered yes here.
 */
describe('ProjectInviteService', () => {
  const OWNER = 'owner-profile';
  const MEMBER = 'member-profile';
  const STRANGER = 'stranger-profile';
  const PROJECT = 'project-1';

  function serviceWith({
    project = { id: PROJECT, owner: OWNER, members: [MEMBER] } as {
      id: string;
      owner: string;
      members: string[];
    } | null,
    existing = null as Record<string, unknown> | null,
  } = {}) {
    const invites = {
      findOne: jest.fn().mockResolvedValue(existing),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((row: unknown) => row),
      save: jest.fn(async (row: unknown) => ({
        id: 'invite-1',
        ...(row as object),
      })),
    };
    const projects = { findOne: jest.fn().mockResolvedValue(project) };
    const service = new ProjectInviteService(
      invites as never,
      projects as never
    );
    return { service, invites, projects };
  }

  /** A refusal, as the house asserts them: the code is what a caller sees. */
  function refused(code: number) {
    return { error: expect.objectContaining({ statusCode: code }) };
  }

  describe('who may invite', () => {
    it('lets the owner invite somebody', async () => {
      const { service, invites } = serviceWith();

      const invite = await service.create(PROJECT, 'new@example.com', OWNER);

      expect(invite.email).toBe('new@example.com');
      expect(invites.save).toHaveBeenCalled();
    });

    it('refuses a member of the project', async () => {
      // Being in a project is not the same as deciding who else is.
      const { service, invites } = serviceWith();

      await expect(
        service.create(PROJECT, 'new@example.com', MEMBER)
      ).rejects.toMatchObject(refused(403));
      expect(invites.save).not.toHaveBeenCalled();
    });

    it('refuses somebody with nothing to do with the project', async () => {
      const { service } = serviceWith();

      await expect(
        service.create(PROJECT, 'new@example.com', STRANGER)
      ).rejects.toMatchObject(refused(403));
    });

    it('refuses in the same words whether or not the project exists', async () => {
      // Otherwise the difference between the two answers is a way to find out
      // which projects exist.
      const { service } = serviceWith();
      const missing = serviceWith({ project: null });

      await expect(
        service.create(PROJECT, 'a@example.com', STRANGER)
      ).rejects.toMatchObject(refused(403));
      await expect(
        missing.service.create(PROJECT, 'a@example.com', STRANGER)
      ).rejects.toMatchObject(refused(403));
    });
  });

  describe('the address', () => {
    it('is folded, so it matches whatever way it was typed', async () => {
      const { service } = serviceWith();

      const invite = await service.create(
        PROJECT,
        '  Someone@Example.COM ',
        OWNER
      );

      expect(invite.email).toBe('someone@example.com');
    });

    it('is required', async () => {
      const { service } = serviceWith();

      await expect(service.create(PROJECT, '   ', OWNER)).rejects.toMatchObject(
        refused(400)
      );
    });

    it('cannot be invited twice while an invitation is open', async () => {
      // Two open rows can be answered differently, and nobody wants to write
      // the code that reconciles them.
      const { service } = serviceWith({
        existing: { id: 'invite-1', status: 'PENDING' },
      });

      await expect(
        service.create(PROJECT, 'again@example.com', OWNER)
      ).rejects.toMatchObject(refused(409));
    });

    it('can be invited again after an answer', async () => {
      // Somebody who declined may be asked again, and somebody who was removed
      // may be invited back.
      const { service, invites } = serviceWith();
      invites.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'old-invite', status: 'DECLINED' });

      const invite = await service.create(PROJECT, 'again@example.com', OWNER);

      expect(invite.id).toBe('old-invite');
      expect(invite.status).toBe('PENDING');
      expect(invite.respondedAt).toBeUndefined();
    });
  });

  describe('the token', () => {
    it('is not something anybody could work out', async () => {
      const { service } = serviceWith();

      const one = await service.create(PROJECT, 'a@example.com', OWNER);
      const two = await service.create(PROJECT, 'b@example.com', OWNER);

      expect(one.token).not.toBe(two.token);
      expect(one.token.length).toBeGreaterThan(30);
      expect(one.token).not.toContain(PROJECT);
    });
  });

  describe('listing and withdrawing', () => {
    it('lets the owner see what is outstanding', async () => {
      const { service, invites } = serviceWith();

      await service.findForProject(PROJECT, OWNER);

      expect(invites.find).toHaveBeenCalled();
    });

    it('refuses a member the list, because it is a list of addresses', async () => {
      const { service } = serviceWith();

      await expect(
        service.findForProject(PROJECT, MEMBER)
      ).rejects.toMatchObject(refused(403));
    });

    it('withdraws one, keeping the record rather than deleting it', async () => {
      const { service, invites } = serviceWith({
        existing: { id: 'invite-1', projectId: PROJECT, status: 'ACCEPTED' },
      });

      const invite = await service.revoke('invite-1', OWNER);

      expect(invite.status).toBe('REVOKED');
      expect(invite.respondedAt).toBeInstanceOf(Date);
      expect(invites.save).toHaveBeenCalled();
    });

    it('refuses an invitation that does not exist, in the same words', async () => {
      // An id that says "no such invitation" differently from "not yours" can
      // be tried until it does.
      const { service } = serviceWith({ existing: null });

      await expect(
        service.revoke('never-existed', OWNER)
      ).rejects.toMatchObject(refused(403));
    });

    it('refuses a member withdrawing anything', async () => {
      const { service } = serviceWith({
        existing: { id: 'invite-1', projectId: PROJECT, status: 'PENDING' },
      });

      await expect(service.revoke('invite-1', MEMBER)).rejects.toMatchObject(
        refused(403)
      );
    });
  });

  /**
   * The invitee's side.
   *
   * Every one of these is scoped by the caller's own address, never by the id
   * they sent. An invitation id is not a secret, and the address it was sent
   * to is the whole of what makes it theirs.
   */
  describe('answering an invitation', () => {
    const INVITEE = 'invitee-profile';
    const THEIR_EMAIL = 'invitee@example.com';

    function withInvite(overrides: Record<string, unknown> = {}) {
      const project = {
        id: PROJECT,
        owner: OWNER,
        members: [MEMBER],
        name: 'Kiln rebuild',
      };
      const invite = {
        id: 'invite-1',
        projectId: PROJECT,
        email: THEIR_EMAIL,
        status: 'PENDING',
        ...overrides,
      };
      const invites = {
        findOne: jest.fn().mockResolvedValue(invite),
        find: jest.fn().mockResolvedValue([invite]),
        create: jest.fn((row: unknown) => row),
        save: jest.fn(async (row: unknown) => row),
      };
      const projects = {
        findOne: jest.fn().mockResolvedValue(project),
        save: jest.fn(async (row: unknown) => row),
      };
      const service = new ProjectInviteService(
        invites as never,
        projects as never
      );
      return { service, invites, projects, project, invite };
    }

    it('accepting is what puts somebody in the project', async () => {
      const { service, projects } = withInvite();

      await service.respond('invite-1', true, THEIR_EMAIL, INVITEE);

      expect(projects.save).toHaveBeenCalledWith(
        expect.objectContaining({ members: [MEMBER, INVITEE] })
      );
    });

    it('declining puts nobody anywhere', async () => {
      const { service, projects, invites } = withInvite();

      await service.respond('invite-1', false, THEIR_EMAIL, INVITEE);

      expect(projects.save).not.toHaveBeenCalled();
      expect(invites.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DECLINED' })
      );
    });

    it('refuses somebody answering an invitation that is not theirs', async () => {
      // Without this, an id anybody guessed would let them into a project.
      const { service, projects } = withInvite();

      await expect(
        service.respond('invite-1', true, 'someone.else@example.com', 'other')
      ).rejects.toMatchObject(refused(403));
      expect(projects.save).not.toHaveBeenCalled();
    });

    it('refuses an invitation that has already been answered', async () => {
      const { service } = withInvite({ status: 'ACCEPTED' });

      await expect(
        service.respond('invite-1', true, THEIR_EMAIL, INVITEE)
      ).rejects.toMatchObject(refused(409));
    });

    it('refuses one that was withdrawn', async () => {
      const { service } = withInvite({ status: 'REVOKED' });

      await expect(
        service.respond('invite-1', true, THEIR_EMAIL, INVITEE)
      ).rejects.toMatchObject(refused(409));
    });

    it('does not add somebody twice', async () => {
      const { service, projects } = withInvite();

      await service.respond('invite-1', true, THEIR_EMAIL, MEMBER);

      expect(projects.save).not.toHaveBeenCalled();
    });

    it('leaves the owner alone if they somehow accept their own', async () => {
      const { service, projects } = withInvite();

      await service.respond('invite-1', true, THEIR_EMAIL, OWNER);

      expect(projects.save).not.toHaveBeenCalled();
    });
  });

  describe('finding what is waiting', () => {
    const INVITEE = 'invitee-profile';
    const THEIR_EMAIL = 'invitee@example.com';

    function waiting(rows: Record<string, unknown>[]) {
      const invites = {
        find: jest.fn().mockResolvedValue(rows),
        findOne: jest.fn().mockResolvedValue(rows[0] ?? null),
        create: jest.fn((row: unknown) => row),
        save: jest.fn(async (row: unknown) => row),
      };
      const projects = {
        findOne: jest
          .fn()
          .mockResolvedValue({ id: PROJECT, name: 'Kiln rebuild' }),
        save: jest.fn(),
      };
      return {
        service: new ProjectInviteService(invites as never, projects as never),
        invites,
      };
    }

    it('says what the project is called, since they cannot read it yet', async () => {
      const { service } = waiting([
        { id: 'i1', projectId: PROJECT, email: THEIR_EMAIL, status: 'PENDING' },
      ]);

      const mine = await service.findForMe(THEIR_EMAIL, INVITEE);

      expect(mine[0].projectName).toBe('Kiln rebuild');
    });

    it('records who turned out to be behind the address', async () => {
      const { service, invites } = waiting([
        { id: 'i1', projectId: PROJECT, email: THEIR_EMAIL, status: 'PENDING' },
      ]);

      await service.findForMe(THEIR_EMAIL, INVITEE);

      expect(invites.save).toHaveBeenCalledWith(
        expect.objectContaining({ claimedBy: INVITEE })
      );
    });

    it('claims without accepting, because being invited is not agreeing', async () => {
      const { service, invites } = waiting([
        { id: 'i1', projectId: PROJECT, email: THEIR_EMAIL, status: 'PENDING' },
      ]);

      const mine = await service.findForMe(THEIR_EMAIL, INVITEE);

      expect(mine[0].status).toBe('PENDING');
      expect(invites.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ACCEPTED' })
      );
    });

    it('has nothing for an address nobody invited', async () => {
      const { service } = waiting([]);

      expect(await service.findForMe('nobody@example.com', INVITEE)).toEqual(
        []
      );
    });

    it('tells a forwarded link nothing, including whether it was real', async () => {
      // The same answer as a token that never existed.
      const { service } = waiting([
        {
          id: 'i1',
          projectId: PROJECT,
          email: THEIR_EMAIL,
          status: 'PENDING',
          token: 't',
        },
      ]);

      expect(
        await service.findByToken('t', 'someone.else@example.com', 'other')
      ).toBeNull();
    });

    it('resolves a link for the person it was sent to', async () => {
      const { service } = waiting([
        {
          id: 'i1',
          projectId: PROJECT,
          email: THEIR_EMAIL,
          status: 'PENDING',
          token: 't',
        },
      ]);

      const found = await service.findByToken('t', THEIR_EMAIL, INVITEE);

      expect(found?.projectName).toBe('Kiln rebuild');
    });
  });

  /**
   * Ending it, from either side.
   *
   * Membership is what access is read from, so removing it is the whole of the
   * effect. Closing the invitation is about the record: one still reading as
   * accepted describes somebody who is not there.
   */
  describe('stopping a collaboration', () => {
    const GONE = 'member-profile';

    function withMember(members = [GONE], accepted = true) {
      const project = { id: PROJECT, owner: OWNER, members: [...members] };
      const invite = accepted
        ? {
            id: 'invite-1',
            projectId: PROJECT,
            claimedBy: GONE,
            status: 'ACCEPTED',
          }
        : null;
      const invites = {
        findOne: jest.fn().mockResolvedValue(invite),
        find: jest.fn().mockResolvedValue([]),
        create: jest.fn((row: unknown) => row),
        save: jest.fn(async (row: unknown) => row),
      };
      const projects = {
        findOne: jest.fn().mockResolvedValue(project),
        save: jest.fn(async (row: unknown) => row),
      };
      return {
        service: new ProjectInviteService(invites as never, projects as never),
        invites,
        projects,
      };
    }

    describe('the owner removing somebody', () => {
      it('takes them out of the members', async () => {
        const { service, projects } = withMember();

        await service.removeMember(PROJECT, GONE, OWNER);

        expect(projects.save).toHaveBeenCalledWith(
          expect.objectContaining({ members: [] })
        );
      });

      it('closes the invitation that put them there', async () => {
        // One still reading as accepted describes somebody who is not there.
        const { service, invites } = withMember();

        await service.removeMember(PROJECT, GONE, OWNER);

        expect(invites.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'REVOKED' })
        );
      });

      it('works for somebody with no invitation behind them', async () => {
        // Membership can predate invitations, and removing has to work anyway.
        const { service, projects } = withMember([GONE], false);

        await service.removeMember(PROJECT, GONE, OWNER);

        expect(projects.save).toHaveBeenCalled();
      });

      it('refuses anybody who is not the owner', async () => {
        const { service, projects } = withMember();

        await expect(
          service.removeMember(PROJECT, GONE, STRANGER)
        ).rejects.toMatchObject(refused(403));
        expect(projects.save).not.toHaveBeenCalled();
      });

      it('refuses removing the owner', async () => {
        // A project with nobody responsible for it is worse than one somebody
        // is stuck with.
        const { service } = withMember();

        await expect(
          service.removeMember(PROJECT, OWNER, OWNER)
        ).rejects.toMatchObject(refused(400));
      });
    });

    describe('a member leaving', () => {
      it('needs nobody else to agree', async () => {
        const { service, projects } = withMember();

        await service.leave(PROJECT, GONE);

        expect(projects.save).toHaveBeenCalledWith(
          expect.objectContaining({ members: [] })
        );
      });

      it('reads as leaving rather than as being removed', async () => {
        // Who ended a collaboration is most of what the record is for.
        const { service, invites } = withMember();

        await service.leave(PROJECT, GONE);

        expect(invites.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'LEFT' })
        );
      });

      it('refuses somebody who is not in the project', async () => {
        const { service } = withMember();

        await expect(service.leave(PROJECT, STRANGER)).rejects.toMatchObject(
          refused(403)
        );
      });

      it('refuses the owner, who is not a member and cannot leave', async () => {
        const { service, projects } = withMember();

        await expect(service.leave(PROJECT, OWNER)).rejects.toMatchObject(
          refused(403)
        );
        expect(projects.save).not.toHaveBeenCalled();
      });
    });
  });

  describe('normaliseEmail', () => {
    it('folds and trims', () => {
      expect(normaliseEmail('  A@B.COM ')).toBe('a@b.com');
    });

    it('survives nothing at all', () => {
      expect(normaliseEmail(null)).toBe('');
      expect(normaliseEmail(undefined)).toBe('');
    });
  });
});
