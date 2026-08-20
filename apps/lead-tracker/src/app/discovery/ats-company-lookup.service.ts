import { Injectable, Logger } from '@nestjs/common';
import {
  AspirationalAtsProvider,
  AspirationalCompany,
} from '@optimistic-tanuki/leads-contracts';
import { boardUrl, candidateTokens } from './ats-board.util';

export type AtsCompanyMatch = AspirationalCompany & {
  /** Openings on the board right now; 0 is a valid board that is simply quiet. */
  openingCount: number;
};

/**
 * Resolves a company name the user typed into a verified ATS board token.
 *
 * Users know company names, not board tokens, and the two frequently differ —
 * "Clean Harbors" is not `cleanharbors`. Rather than guessing and letting the
 * provider 404 forever in silence, this tries the conventional token forms
 * against the live APIs and only returns boards that actually answered.
 */
@Injectable()
export class AtsCompanyLookupService {
  private readonly logger = new Logger(AtsCompanyLookupService.name);
  private readonly providers: AspirationalAtsProvider[] = [
    'greenhouse',
    'lever',
  ];

  async lookup(companyName: string): Promise<AtsCompanyMatch[]> {
    const label = (companyName || '').trim();
    if (!label) {
      return [];
    }

    const tokens = candidateTokens(label);
    const attempts: Array<Promise<AtsCompanyMatch | null>> = [];

    for (const provider of this.providers) {
      for (const token of tokens) {
        attempts.push(this.verify(provider, token, label));
      }
    }

    const matches = (await Promise.all(attempts)).filter(
      (match): match is AtsCompanyMatch => match !== null
    );

    // A board with openings is more useful to show first than a quiet one.
    return matches.sort((a, b) => b.openingCount - a.openingCount);
  }

  private async verify(
    provider: AspirationalAtsProvider,
    token: string,
    label: string
  ): Promise<AtsCompanyMatch | null> {
    try {
      const response = await fetch(boardUrl(provider, token), {
        headers: { accept: 'application/json' },
      });

      // Both APIs answer 404 for an unknown token, which is what makes this
      // verification meaningful rather than a guess.
      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const openingCount = Array.isArray(payload)
        ? payload.length
        : Array.isArray((payload as { jobs?: unknown[] })?.jobs)
        ? (payload as { jobs: unknown[] }).jobs.length
        : 0;

      return { provider, token, label, openingCount };
    } catch (error) {
      this.logger.warn(
        `ATS lookup failed for ${provider}/${token}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return null;
    }
  }
}
