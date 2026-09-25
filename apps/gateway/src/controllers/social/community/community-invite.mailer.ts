import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  EmailService,
  renderDomainEmailTemplate,
} from '@optimistic-tanuki/email';

import { GATEWAY_APP_REGISTRY } from '../registry/registry.controller';
import type { AppRegistry } from '@optimistic-tanuki/app-registry-backend';

/**
 * Telling somebody they have been invited to a community.
 *
 * Sent from here rather than from social, which owns the invitation and knows
 * nothing about which application it is for or where that application lives.
 * The gateway already holds the app registry and already sends mail, so this
 * needed nothing new to exist.
 *
 * The record is saved before any of this runs. A failure to send costs a
 * courtesy and never the invitation, because the invitation is also
 * discoverable inside the application by whoever it was addressed to.
 */
@Injectable()
export class CommunityInviteMailer {
  private readonly logger = new Logger(CommunityInviteMailer.name);

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
    communityName?: string;
    invitedByName?: string;
    appScope?: string;
  }): Promise<void> {
    try {
      const appId = appIdForCommunityScope(invite.appScope);
      const app = this.registry?.apps?.find((a) => a.appId === appId);
      if (!this.email || !app?.uiBaseUrl) {
        this.logger.warn(
          `No way to send the community invitation for ${appId}; it is still waiting in the application`
        );
        return;
      }

      // The renderer produces the body and not the subject, so this says it.
      const subject = invite.communityName
        ? `You have been invited to ${invite.communityName}`
        : 'You have been invited to a community';

      const template = renderDomainEmailTemplate({
        domain: app.uiBaseUrl,
        appName: app.name ?? appId,
        heading: subject,
        body: [
          invite.invitedByName
            ? `${invite.invitedByName} has invited you to join them.`
            : 'Somebody has invited you to join them.',
          // Said plainly, because an invitation that reads as an account
          // already made is a surprise on the other side of the link.
          'If you do not have an account yet, you can make one and the invitation will be waiting.',
        ],
        action: {
          label: 'Open the invitation',
          url: communityInvitationUrl(app.uiBaseUrl, invite.token),
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
          `Could not send the community invitation to ${invite.email}: ${
            result?.error ?? 'no reason given'
          }`
        );
      }
    } catch (error) {
      this.logger.warn(
        `Could not send the community invitation to ${invite.email}: ${
          (error as Error).message
        }`
      );
    }
  }
}

/**
 * Communities carry an `appScope` (`social`, `local-hub`, …) while the
 * registry is keyed by `appId`. Both community frontends serve the shared
 * invitation landing page at `/invitation/:token`.
 */
export function appIdForCommunityScope(appScope?: string): string {
  const normalized = (appScope ?? '').trim().toLowerCase();
  if (normalized === 'local-hub' || normalized === 'local hub') {
    return 'local-hub';
  }
  return 'client-interface';
}

/**
 * Where the link points.
 *
 * The token is in the path rather than the fragment, because the application
 * has to send it to the server to find out what it is for, and a fragment
 * never leaves the browser. It is unguessable, so what protects it is its own
 * randomness rather than where it sits.
 */
export function communityInvitationUrl(
  uiBaseUrl: string,
  token: string
): string {
  return `${uiBaseUrl.replace(/\/$/, '')}/invitation/${encodeURIComponent(
    token
  )}`;
}
