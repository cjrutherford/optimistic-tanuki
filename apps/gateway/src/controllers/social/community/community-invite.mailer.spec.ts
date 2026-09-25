import {
  CommunityInviteMailer,
  appIdForCommunityScope,
  communityInvitationUrl,
} from './community-invite.mailer';

/**
 * Telling somebody they have been invited to a community.
 *
 * The record is saved before any of this runs, and the invitation is also
 * discoverable inside the application by whoever it was addressed to. So the
 * only thing this must never do is fail loudly enough to undo the thing that
 * already worked.
 */
describe('CommunityInviteMailer', () => {
  const registry = {
    apps: [
      {
        appId: 'client-interface',
        name: 'Optimistic Tanuki',
        uiBaseUrl: 'http://localhost:8080',
        authEmail: { from: 'no-reply@optimistic-tanuki.com' },
      },
      {
        appId: 'local-hub',
        name: 'Towne Square',
        uiBaseUrl: 'http://localhost:8087',
        authEmail: { from: 'no-reply@towne-square.com' },
      },
    ],
  };

  function mailerWith(
    sendEmail = jest.fn().mockResolvedValue({ success: true })
  ) {
    const email = { sendEmail };
    const mailer = new CommunityInviteMailer(email as never, registry as never);
    return { mailer, sendEmail };
  }

  const invite = {
    email: 'someone@example.com',
    token: 'a-token',
    communityName: 'Savannah Gardeners',
    invitedByName: 'Ada',
    appScope: 'social',
  };

  it('sends to the address that was invited', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'someone@example.com',
        from: 'no-reply@optimistic-tanuki.com',
      })
    );
  });

  it('names the community, so the invitation says what it is for', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].subject).toContain('Savannah Gardeners');
  });

  it('carries the link, and the token in it', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].text).toContain(
      'http://localhost:8080/invitation/a-token'
    );
  });

  it('says an account is not needed yet', async () => {
    // An invitation that reads as an account already made is a surprise on
    // the other side of the link.
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].text).toMatch(/do not have an account/i);
  });

  it('routes local-hub scopes to the Towne Square app', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send({ ...invite, appScope: 'local-hub' });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'no-reply@towne-square.com',
      })
    );
    expect(sendEmail.mock.calls[0][0].text).toContain(
      'http://localhost:8087/invitation/a-token'
    );
  });

  describe('when it cannot be sent', () => {
    it('does not throw when the provider refuses', async () => {
      const { mailer } = mailerWith(
        jest.fn().mockResolvedValue({ success: false, error: 'no route' })
      );

      await expect(mailer.send(invite)).resolves.toBeUndefined();
    });

    it('does not throw when the provider explodes', async () => {
      const { mailer } = mailerWith(
        jest.fn().mockRejectedValue(new Error('smtp is down'))
      );

      await expect(mailer.send(invite)).resolves.toBeUndefined();
    });

    it('does not throw when there is no mail service at all', async () => {
      const mailer = new CommunityInviteMailer(undefined, registry as never);

      await expect(mailer.send(invite)).resolves.toBeUndefined();
    });
  });
});

describe('appIdForCommunityScope', () => {
  it('maps local-hub scopes to the local-hub app', () => {
    expect(appIdForCommunityScope('local-hub')).toBe('local-hub');
    expect(appIdForCommunityScope('local hub')).toBe('local-hub');
  });

  it('defaults every other scope to client-interface', () => {
    expect(appIdForCommunityScope('social')).toBe('client-interface');
    expect(appIdForCommunityScope(undefined)).toBe('client-interface');
  });
});

describe('communityInvitationUrl', () => {
  it('points at the shared invitation landing page', () => {
    expect(communityInvitationUrl('http://localhost:8080/', 'tok en')).toBe(
      'http://localhost:8080/invitation/tok%20en'
    );
  });
});
