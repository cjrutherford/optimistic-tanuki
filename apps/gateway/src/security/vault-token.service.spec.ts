import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { VAULT_TOKEN_PURPOSES, VaultTokenService } from './vault-token.service';

describe('VaultTokenService', () => {
  const claims = {
    tenantId: 'wirepro-cpa',
    documentId: 'drop-1',
    purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
    jti: 'token-jti-1',
    iat: 1700000000,
    exp: 1700000900,
  };

  const financeClient = { send: jest.fn() };
  let service: VaultTokenService;

  beforeEach(() => {
    financeClient.send.mockReset();
    service = new VaultTokenService(financeClient as never);
  });

  it('issues tokens through finance and returns the token string', async () => {
    financeClient.send.mockReturnValue(
      of({ token: 'payload.signature', ...claims })
    );

    const token = await service.issue({
      tenantId: 'wirepro-cpa',
      documentId: 'drop-1',
      purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
    });

    expect(token).toBe('payload.signature');
    expect(financeClient.send).toHaveBeenCalledWith(
      'vault.issue_token',
      expect.objectContaining({
        tenantId: 'wirepro-cpa',
        documentId: 'drop-1',
      })
    );
  });

  it('validates tokens through finance and returns claims', async () => {
    financeClient.send.mockReturnValue(of(claims));

    const result = await service.validate(
      'payload.signature',
      VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      'wirepro-cpa',
      'drop-1'
    );

    expect(result).toEqual(claims);
    expect(financeClient.send).toHaveBeenCalledWith(
      'vault.validate_token',
      expect.objectContaining({
        token: 'payload.signature',
        expectedTenantId: 'wirepro-cpa',
        expectedDocumentId: 'drop-1',
      })
    );
  });

  it('consumes tokens through finance exactly once per call', async () => {
    financeClient.send.mockReturnValue(of(claims));

    await service.consume(
      'payload.signature',
      VAULT_TOKEN_PURPOSES.DOCUMENT_DROP
    );

    expect(financeClient.send).toHaveBeenCalledWith(
      'vault.consume_token',
      expect.objectContaining({ token: 'payload.signature' })
    );
  });

  it('revokes tokens through finance', async () => {
    financeClient.send.mockReturnValue(of(claims));

    await service.revoke('payload.signature');

    expect(financeClient.send).toHaveBeenCalledWith('vault.revoke_token', {
      token: 'payload.signature',
    });
  });

  it.each([
    [400, BadRequestException],
    [401, UnauthorizedException],
    [403, ForbiddenException],
  ])(
    'maps finance status %i to the matching HTTP exception',
    async (status, type) => {
      financeClient.send.mockReturnValue(
        throwError(() => ({
          statusCode: status,
          message: 'Denied by finance.',
        }))
      );

      await expect(
        service.validate(
          'payload.signature',
          VAULT_TOKEN_PURPOSES.DOCUMENT_DROP
        )
      ).rejects.toBeInstanceOf(type);
      await expect(
        service.validate(
          'payload.signature',
          VAULT_TOKEN_PURPOSES.DOCUMENT_DROP
        )
      ).rejects.toThrow('Denied by finance.');
    }
  );

  it('fails closed when finance is unreachable or returns no claims', async () => {
    financeClient.send.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED'))
    );

    await expect(
      service.validate('payload.signature', VAULT_TOKEN_PURPOSES.DOCUMENT_DROP)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    financeClient.send.mockReturnValue(of(null));

    await expect(
      service.consume('payload.signature', VAULT_TOKEN_PURPOSES.DOCUMENT_DROP)
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('fails closed when issuance returns no token', async () => {
    financeClient.send.mockReturnValue(of({ token: '' }));

    await expect(
      service.issue({
        tenantId: 'wirepro-cpa',
        documentId: 'drop-1',
        purpose: VAULT_TOKEN_PURPOSES.DOCUMENT_DROP,
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
