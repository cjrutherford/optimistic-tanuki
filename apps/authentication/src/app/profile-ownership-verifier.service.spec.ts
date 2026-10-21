import { NEVER, of, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';
import { ClientProxy } from '@nestjs/microservices';
import { ProfileCommands } from '@optimistic-tanuki/constants';
import { ProfileOwnershipVerifier } from './profile-ownership-verifier.service';

const ACCOUNT = 'a1111111-a111-4111-8111-a11111111111';
const PROFILE = 'b2222222-b222-4222-8222-b22222222222';

describe('ProfileOwnershipVerifier', () => {
  const client = { send: jest.fn() };
  let verifier: ProfileOwnershipVerifier;

  beforeEach(() => {
    jest.clearAllMocks();
    verifier = new ProfileOwnershipVerifier(client as unknown as ClientProxy);
    client.send.mockReturnValue(
      of({ accountId: ACCOUNT, profileId: PROFILE, owned: true })
    );
  });

  it('returns the canonical selected profile after a scoped ownership proof', async () => {
    await expect(
      verifier.resolveSelection(ACCOUNT.toUpperCase(), PROFILE.toUpperCase())
    ).resolves.toBe(PROFILE);
    expect(client.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.CheckAccountProfileOwnership },
      { accountId: ACCOUNT, profileId: PROFILE }
    );
  });

  it('keeps absent and empty selections profileless without RPC', async () => {
    await expect(verifier.resolveSelection(ACCOUNT, undefined)).resolves.toBe(
      undefined
    );
    await expect(verifier.resolveSelection(ACCOUNT, null)).resolves.toBe(
      undefined
    );
    await expect(verifier.resolveSelection(ACCOUNT, '')).resolves.toBe(
      undefined
    );
    expect(client.send).not.toHaveBeenCalled();
  });

  it.each([0, false, {}, 'not-a-uuid'])(
    'rejects invalid selection %p',
    async (selection) => {
      await expect(
        verifier.resolveSelection(ACCOUNT, selection)
      ).rejects.toBeInstanceOf(RpcException);
      expect(client.send).not.toHaveBeenCalled();
    }
  );

  it.each([
    { accountId: ACCOUNT, profileId: PROFILE, owned: false },
    { accountId: ACCOUNT, profileId: PROFILE, owned: 'true' },
    { accountId: ACCOUNT.toUpperCase(), profileId: PROFILE, owned: true },
    { accountId: ACCOUNT, profileId: PROFILE.toUpperCase(), owned: true },
    { accountId: ACCOUNT, profileId: PROFILE, owned: true, extra: 'secret' },
    null,
    'malformed',
  ])('fails closed for an invalid ownership reply %p', async (reply) => {
    client.send.mockReturnValue(of(reply));
    await expect(
      verifier.resolveSelection(ACCOUNT, PROFILE)
    ).rejects.toBeInstanceOf(RpcException);
  });

  it('fails closed when the profile service is unavailable', async () => {
    client.send.mockReturnValue(throwError(() => new Error('private detail')));
    let failure: unknown;
    try {
      await verifier.resolveSelection(ACCOUNT, PROFILE);
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(RpcException);
    expect((failure as RpcException).message).not.toContain('private detail');
  });

  it('bounds the profile service wait', async () => {
    client.send.mockReturnValue(NEVER);
    await expect(
      verifier.resolveSelection(ACCOUNT, PROFILE)
    ).rejects.toBeInstanceOf(RpcException);
  });
});
