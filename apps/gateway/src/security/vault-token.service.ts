import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import {
  VAULT_CONSUME_TOKEN,
  VAULT_ISSUE_TOKEN,
  VAULT_REVOKE_TOKEN,
  VAULT_VALIDATE_TOKEN,
} from '@optimistic-tanuki/constants';
import {
  VaultTokenCheckInput,
  VaultTokenClaims,
  VaultTokenIssueInput,
  VaultTokenIssueResult,
  VaultTokenPurpose,
} from '@optimistic-tanuki/models';

export const VAULT_TOKEN_PURPOSES = {
  DOCUMENT_DROP: 'document-drop',
  ESCROW_WIRE: 'escrow-wire',
} as const;

export type { VaultTokenPurpose, VaultTokenClaims, VaultTokenIssueResult };
export type VaultTokenIssue = VaultTokenIssueInput;

@Injectable()
export class VaultTokenService {
  constructor(
    @Inject(ServiceTokens.FINANCE_SERVICE)
    private readonly financeClient: ClientProxy
  ) {}

  async issue(input: VaultTokenIssueInput): Promise<string> {
    const issued = await this.send<VaultTokenIssueResult>(
      VAULT_ISSUE_TOKEN,
      input ?? {}
    );
    if (!issued || typeof issued.token !== 'string' || !issued.token) {
      throw new ServiceUnavailableException(
        'Vault token issuance did not return a token.'
      );
    }
    return issued.token;
  }

  async validate(
    rawToken: string,
    purpose: VaultTokenPurpose,
    expectedTenantId?: string,
    expectedDocumentId?: string
  ): Promise<VaultTokenClaims> {
    const claims = await this.send<VaultTokenClaims>(VAULT_VALIDATE_TOKEN, {
      token: rawToken,
      purpose,
      expectedTenantId,
      expectedDocumentId,
    } as VaultTokenCheckInput);
    return this.requireClaims(claims);
  }

  async consume(
    rawToken: string,
    purpose: VaultTokenPurpose,
    expectedTenantId?: string,
    expectedDocumentId?: string
  ): Promise<VaultTokenClaims> {
    const claims = await this.send<VaultTokenClaims>(VAULT_CONSUME_TOKEN, {
      token: rawToken,
      purpose,
      expectedTenantId,
      expectedDocumentId,
    } as VaultTokenCheckInput);
    return this.requireClaims(claims);
  }

  async revoke(rawToken: string): Promise<VaultTokenClaims> {
    const claims = await this.send<VaultTokenClaims>(VAULT_REVOKE_TOKEN, {
      token: rawToken,
    });
    return this.requireClaims(claims);
  }

  private async send<T>(pattern: string, payload: unknown): Promise<T> {
    try {
      return await firstValueFrom(this.financeClient.send<T>(pattern, payload));
    } catch (error) {
      throw this.mapFinanceError(error);
    }
  }

  private requireClaims(claims: VaultTokenClaims): VaultTokenClaims {
    if (
      !claims ||
      typeof claims !== 'object' ||
      typeof (claims as { tenantId?: unknown }).tenantId !== 'string' ||
      typeof (claims as { jti?: unknown }).jti !== 'string'
    ) {
      throw new ServiceUnavailableException(
        'Vault token verification did not return claims.'
      );
    }
    return claims;
  }

  private mapFinanceError(error: unknown): Error {
    const status =
      typeof error === 'object' && error !== null
        ? (error as { statusCode?: unknown; status?: unknown }).statusCode ??
          (error as { status?: unknown }).status
        : undefined;
    const message =
      typeof error === 'object' &&
      error !== null &&
      typeof (error as { message?: unknown }).message === 'string'
        ? ((error as { message: string }).message as string)
        : 'Vault token verification is unavailable.';
    if (status === 400) {
      return new BadRequestException(message);
    }
    if (status === 401) {
      return new UnauthorizedException(message);
    }
    if (status === 403) {
      return new ForbiddenException(message);
    }
    return new ServiceUnavailableException(message);
  }
}
