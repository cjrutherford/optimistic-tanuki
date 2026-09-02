import { randomBytes } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { assertProjectOwner } from '../common/project-access.util';
import { Project } from '../entities/project.entity';
import { ProjectInvite } from '../entities/project-invite.entity';

/**
 * Inviting somebody to work on a project.
 *
 * Only the owner may invite, list or withdraw. Listing is as guarded as
 * inviting, because an invitation carries an email address and who is working
 * on a project is not public.
 *
 * Nothing here resolves an address to a person. The gateway already knows the
 * caller's own email from their session, so an invitation can be found by the
 * person it was addressed to without this service ever asking another one who
 * anybody is. That keeps it a service that owns project data rather than one
 * that also knows about accounts.
 */
@Injectable()
export class ProjectInviteService {
  private readonly logger = new Logger(ProjectInviteService.name);

  constructor(
    @Inject(getRepositoryToken(ProjectInvite))
    private readonly invites: Repository<ProjectInvite>,
    @Inject(getRepositoryToken(Project))
    private readonly projects: Repository<Project>
  ) {}

  /**
   * Invite an address, on behalf of the owner.
   *
   * Refuses somebody already in the project, because an invitation they could
   * accept to gain what they have is a decision that means nothing. Refuses a
   * second open invitation to the same address for the same reason, and
   * because two rows can be answered differently and nobody wants to write the
   * code that reconciles them.
   */
  async create(
    projectId: string,
    email: string,
    invitedBy: string
  ): Promise<ProjectInvite> {
    // Deliberately not assertFound first. A project that does not exist and a
    // project somebody does not own have to answer identically, or the
    // difference between 404 and 403 is a way to find out what exists.
    assertProjectOwner(
      await this.projects.findOne({ where: { id: projectId } }),
      invitedBy
    );

    const address = normaliseEmail(email);
    if (!address) {
      throw new RpcException({
        statusCode: 400,
        message: 'An email address is required to invite somebody',
      });
    }

    const open = await this.invites.findOne({
      where: { projectId, email: address, status: 'PENDING' },
    });
    if (open) {
      throw new RpcException({
        statusCode: 409,
        message: 'That address has already been invited to this project',
      });
    }

    // An answered invitation to the same address is replaced rather than
    // refused: somebody who declined once may be asked again, and somebody
    // evicted may be invited back. The unique index means there is one row per
    // address per project, so this reopens it.
    const previous = await this.invites.findOne({
      where: { projectId, email: address },
    });

    const invite = this.invites.create({
      ...(previous ? { id: previous.id } : {}),
      projectId,
      email: address,
      invitedBy,
      token: newToken(),
      status: 'PENDING',
      claimedBy: undefined,
      respondedAt: undefined,
    });

    const saved = await this.invites.save(invite);
    this.logger.log(`Invited ${address} to project ${projectId}`);
    return saved;
  }

  /** Everything on a project, most recent first. Owner only. */
  async findForProject(
    projectId: string,
    requestingUserId: string
  ): Promise<ProjectInvite[]> {
    assertProjectOwner(
      await this.projects.findOne({ where: { id: projectId } }),
      requestingUserId
    );

    return await this.invites.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Withdraw an invitation.
   *
   * Allowed after it has been accepted as well as before. Withdrawing an
   * accepted invitation is how the record stays true when somebody is removed
   * from a project, and this service does not remove them: that is membership,
   * and it has its own door.
   */
  async revoke(
    inviteId: string,
    requestingUserId: string
  ): Promise<ProjectInvite> {
    const invite = await this.invites.findOne({ where: { id: inviteId } });
    if (!invite) {
      // Word for word what not owning one says. An id that answers "no such
      // invitation" differently from "not yours" can be tried until it does.
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: you do not have access to this project',
      });
    }

    assertProjectOwner(
      await this.projects.findOne({ where: { id: invite.projectId } }),
      requestingUserId
    );

    invite.status = 'REVOKED';
    invite.respondedAt = new Date();
    return await this.invites.save(invite);
  }
  /**
   * Everything waiting on an address, claimed by whoever is asking.
   *
   * Claiming records which profile turned out to be behind the address. It
   * does not accept anything: being invited is not agreeing, and joining
   * somebody to a project because they happened to sign in is not a decision
   * to take for them.
   *
   * The project's name comes back with each one, which is a deliberate and
   * small disclosure. Somebody has to be told what they are being invited to
   * before they can answer, and they were sent the invitation.
   */
  async findForMe(
    email: string,
    profileId: string
  ): Promise<(ProjectInvite & { projectName?: string })[]> {
    const address = normaliseEmail(email);
    if (!address) return [];

    const waiting = await this.invites.find({
      where: { email: address, status: 'PENDING' },
      order: { createdAt: 'DESC' },
    });

    return await Promise.all(
      waiting.map(async (invite) => {
        if (invite.claimedBy !== profileId) {
          invite.claimedBy = profileId;
          await this.invites.save(invite);
        }
        return { ...invite, projectName: await this.projectName(invite) };
      })
    );
  }

  /**
   * One invitation, by the token in a link.
   *
   * Answers nothing to somebody whose address it is not, in the same words as
   * a token that never existed. A link forwarded to the wrong person should
   * tell them nothing, including whether it was ever real.
   */
  async findByToken(
    token: string,
    email: string,
    profileId: string
  ): Promise<(ProjectInvite & { projectName?: string }) | null> {
    const invite = await this.invites.findOne({ where: { token } });
    if (!invite || invite.email !== normaliseEmail(email)) return null;

    if (invite.claimedBy !== profileId) {
      invite.claimedBy = profileId;
      await this.invites.save(invite);
    }
    return { ...invite, projectName: await this.projectName(invite) };
  }

  /**
   * The invitee's answer, which is the only thing that grants access.
   *
   * Checked against the caller's own address rather than against the id they
   * sent. An invitation id is not a secret, and without this anybody could
   * accept somebody else's by guessing one.
   */
  async respond(
    inviteId: string,
    accept: boolean,
    email: string,
    profileId: string
  ): Promise<ProjectInvite> {
    const invite = await this.invites.findOne({ where: { id: inviteId } });
    if (!invite || invite.email !== normaliseEmail(email)) {
      throw new RpcException({
        statusCode: 403,
        message: 'Forbidden: that invitation is not yours to answer',
      });
    }

    if (invite.status !== 'PENDING') {
      throw new RpcException({
        statusCode: 409,
        message: 'That invitation has already been answered',
      });
    }

    invite.status = accept ? 'ACCEPTED' : 'DECLINED';
    invite.claimedBy = profileId;
    invite.respondedAt = new Date();

    if (accept) {
      await this.addMember(invite.projectId, profileId);
    }

    return await this.invites.save(invite);
  }

  /**
   * Join somebody to a project.
   *
   * Deliberately not through the project service's update, which refuses a
   * members change on purpose: members should not be settable by anybody who
   * can edit a project's name. Joining is a different act with a different
   * rule, and it deserves a different door rather than a hole in that one.
   */
  private async addMember(projectId: string, profileId: string): Promise<void> {
    const project = await this.projects.findOne({ where: { id: projectId } });
    if (!project) {
      throw new RpcException({
        statusCode: 404,
        message: 'That project no longer exists',
      });
    }

    const members = project.members ?? [];
    if (members.includes(profileId) || project.owner === profileId) return;

    project.members = [...members, profileId];
    await this.projects.save(project);
  }

  /** What the project is called, for somebody who cannot yet read it. */
  private async projectName(
    invite: ProjectInvite
  ): Promise<string | undefined> {
    const project = await this.projects.findOne({
      where: { id: invite.projectId },
    });
    return project?.name;
  }
}

/**
 * One form of an address in the table.
 *
 * Folded and trimmed, because it is the key everything matches on and an
 * address kept as it was typed stops matching the day somebody capitalises
 * their own name differently.
 */
export function normaliseEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

/**
 * What the link carries.
 *
 * Random rather than derived from anything: a token that can be worked out
 * from a project id or an address is not a secret, and this one is the whole
 * of what proves an invitation was received by the person it was sent to.
 */
function newToken(): string {
  return randomBytes(32).toString('base64url');
}
