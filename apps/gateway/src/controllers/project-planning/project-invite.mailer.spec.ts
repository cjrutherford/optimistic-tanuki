import { ProjectInviteMailer, invitationUrl } from './project-invite.mailer';

/**
 * Telling somebody they have been invited.
 *
 * The record is saved before any of this runs, and the invitation is also
 * discoverable inside the application by whoever it was addressed to. So the
 * only thing this must never do is fail loudly enough to undo the thing that
 * already worked.
 */
describe('ProjectInviteMailer', () => {
  const registry = {
    apps: [
      {
        appId: 'forgeofwill',
        name: 'Forge of Will',
        uiBaseUrl: 'http://localhost:8081',
        authEmail: { from: 'no-reply@forgeofwill.com' },
      },
    ],
  };

  function mailerWith(
    sendEmail = jest.fn().mockResolvedValue({ success: true })
  ) {
    const email = { sendEmail };
    const mailer = new ProjectInviteMailer(email as never, registry as never);
    return { mailer, sendEmail };
  }

  const invite = {
    email: 'someone@example.com',
    token: 'a-token',
    projectName: 'Kiln rebuild',
    invitedByName: 'Fow Two',
    appId: 'forgeofwill',
  };

  it('sends to the address that was invited', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'someone@example.com',
        from: 'no-reply@forgeofwill.com',
      })
    );
  });

  it('names the project, so the invitation says what it is for', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].subject).toContain('Kiln rebuild');
  });

  it('carries the link, and the token in it', async () => {
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].text).toContain(
      'http://localhost:8081/invitations/a-token'
    );
  });

  it('says an account is not needed yet', async () => {
    // An invitation that reads as an account already made is a surprise on
    // the other side of the link.
    const { mailer, sendEmail } = mailerWith();

    await mailer.send(invite);

    expect(sendEmail.mock.calls[0][0].text).toMatch(/do not have an account/i);
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
      const mailer = new ProjectInviteMailer(undefined, registry as never);

      await expect(mailer.send(invite)).resolves.toBeUndefined();
    });

    it('does not throw when the application is not in the registry', async () => {
      const { mailer, sendEmail } = mailerWith();

      await mailer.send({ ...invite, appId: 'not-an-app' });

      expect(sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('invitationUrl', () => {
    it('does not double the slash on a base that ends in one', () => {
      expect(invitationUrl('http://x/', 't')).toBe('http://x/invitations/t');
    });

    it('escapes a token so it survives being a path', () => {
      // base64url avoids the characters that would need this, and the next
      // token format should not be able to break the link by being different.
      expect(invitationUrl('http://x', 'a/b')).toBe(
        'http://x/invitations/a%2Fb'
      );
    });
  });
});
