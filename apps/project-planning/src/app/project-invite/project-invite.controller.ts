import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProjectInviteCommands } from '@optimistic-tanuki/constants';

import { ProjectInviteService } from './project-invite.service';

/**
 * Inviting somebody, as messages.
 *
 * Every one of these carries `requestingUserId`, which the gateway takes from
 * the authenticated session rather than from anything the caller sent. The
 * service refuses anyone who is not the project's owner, so the identity has
 * to be one the caller could not have chosen.
 */
@Controller()
export class ProjectInviteController {
  constructor(private readonly invites: ProjectInviteService) {}

  @MessagePattern({ cmd: ProjectInviteCommands.CREATE })
  async create(
    @Payload()
    payload: {
      projectId: string;
      email: string;
      requestingUserId: string;
    }
  ) {
    return await this.invites.create(
      payload.projectId,
      payload.email,
      payload.requestingUserId
    );
  }

  @MessagePattern({ cmd: ProjectInviteCommands.FIND_FOR_PROJECT })
  async findForProject(
    @Payload() payload: { projectId: string; requestingUserId: string }
  ) {
    return await this.invites.findForProject(
      payload.projectId,
      payload.requestingUserId
    );
  }

  /**
   * The three below carry the caller's own email as well as their profile.
   * Both come from the session, so an invitation can only be seen or answered
   * by the address it was sent to.
   */
  @MessagePattern({ cmd: ProjectInviteCommands.FIND_FOR_ME })
  async findForMe(
    @Payload() payload: { email: string; requestingUserId: string }
  ) {
    return await this.invites.findForMe(
      payload.email,
      payload.requestingUserId
    );
  }

  @MessagePattern({ cmd: ProjectInviteCommands.FIND_BY_TOKEN })
  async findByToken(
    @Payload()
    payload: {
      token: string;
      email: string;
      requestingUserId: string;
    }
  ) {
    return await this.invites.findByToken(
      payload.token,
      payload.email,
      payload.requestingUserId
    );
  }

  @MessagePattern({ cmd: ProjectInviteCommands.RESPOND })
  async respond(
    @Payload()
    payload: {
      id: string;
      accept: boolean;
      email: string;
      requestingUserId: string;
    }
  ) {
    return await this.invites.respond(
      payload.id,
      payload.accept,
      payload.email,
      payload.requestingUserId
    );
  }

  @MessagePattern({ cmd: ProjectInviteCommands.REVOKE })
  async revoke(@Payload() payload: { id: string; requestingUserId: string }) {
    return await this.invites.revoke(payload.id, payload.requestingUserId);
  }
}
