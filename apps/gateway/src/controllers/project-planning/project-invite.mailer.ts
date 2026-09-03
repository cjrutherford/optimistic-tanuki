import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  EmailService,
  renderDomainEmailTemplate,
} from '@optimistic-tanuki/email';

import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';

/**
 * Telling somebody they have been invited.
 *
 * Sent from here rather than from project-planning, which owns the invitation
 * and knows nothing about which application it is for or where that
 * application lives. The gateway already holds the app registry and already
 * sends mail, so this needed nothing new to exist.
 *
 * The record is saved before any of this runs. A failure to send costs a
 * courtesy and never the invitation, because the invitation is also
 * discoverable inside the application by whoever it was addressed to.
 */
@Injectable()
export class ProjectInviteMailer {
  private readonly logger = new Logger(ProjectInviteMailer.name);

  constructor(
    @Optional() private readonly email?: EmailService,
    @Optional()
    @Inject(GATEWAY_APP_REGISTRY)
    private readonly registry?: AppRegistry
  ) {}

  /**
   * Never throws.
   *
   * Whatever goes wrong here, the caller has already committed an invitation
   * that works. Turning a failed courtesy into a failed request would lose the
   * thing that matters to protect the thing that does not.
   */
  async send(invite: {
    email: string;
    token: string;
    projectName?: string;
    invitedByName?: string;
    appId: string;
  }): Promise<void> {
    try {
      const app = this.registry?.apps?.find((a) => a.appId === invite.appId);
      if (!this.email || !app?.uiBaseUrl) {
        this.logger.warn(
          `No way to send the invitation for ${invite.appId}; it is still waiting in the application`
        );
        return;
      }

      // The renderer produces the body and not the subject, so this says it.
      const subject = invite.projectName
        ? `You have been invited to ${invite.projectName}`
        : 'You have been invited to a project';

      const template = renderDomainEmailTemplate({
        domain: app.uiBaseUrl,
        appName: app.name ?? invite.appId,
        heading: subject,
        body: [
          invite.invitedByName
            ? `${invite.invitedByName} has invited you to work with them.`
            : 'Somebody has invited you to work with them.',
          // Said plainly, because an invitation that reads as an account
          // already made is a surprise on the other side of the link.
          'If you do not have an account yet, you can make one and the invitation will be waiting.',
        ],
        action: {
          label: 'Open the invitation',
          url: invitationUrl(app.uiBaseUrl, invite.token),
        },
        note: 'If you were not expecting this, you can ignore it and nothing will happen.',
      });

      const result = await this.email.sendEmail({
        to: invite.email,
        from: app.authEmail?.from,
        subject,
        text: template.text,
        html: template.html,
      });

      if (!result?.success) {
        this.logger.warn(
          `Could not send the invitation to ${invite.email}: ${
            result?.error ?? 'no reason given'
          }`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not send the invitation to ${invite.email}: ${
          (error as Error).message
        }`
      );
    }
  }
}

/**
 * Where the link points.
 *
 * The token is in the path rather than the fragment, because the application
 * has to send it to the server to find out what it is for, and a fragment
 * never leaves the browser. It is unguessable, so what protects it is its own
 * randomness rather than where it sits.
 */
export function invitationUrl(uiBaseUrl: string, token: string): string {
  return `${uiBaseUrl.replace(/\/$/, '')}/invitations/${encodeURIComponent(
    token
  )}`;
}
