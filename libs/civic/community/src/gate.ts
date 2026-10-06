/**
 * The corroboration gate: independence, then trust mass.
 *
 * A report is corroborated when independent contributions supporting it
 * carry enough weight. Independence is structural, not counted: two
 * contributions collapse to one source when they come from the same account,
 * the same network or device, a burst of submissions within minutes of each
 * other, or rest on the same file or link. An official's material is the
 * official record and never counts as community corroboration; nor does a
 * corroboration from someone who disclosed an interest in the matter.
 *
 * Weight comes from the account (a base for anyone past the verification
 * floor), from an attached document, photograph or recording, and from
 * standing earned by confirmed reports (Phase C). No one account supplies
 * more than the cap, so nobody publishes alone however trusted.
 *
 * Every member gets a verdict with its reasons, in words its contributor is
 * shown. The gate reports state — corroborated or not — never a tally.
 */

export interface GateMember {
  id: string;
  contributorId: string;
  /** The report itself, or a corroboration of it. */
  role: 'report' | 'corroboration';
  submittedAt: Date;
  /** Material from a verified official: the official record, not community corroboration. */
  official: boolean;
  disclosedInterest: string | null;
  /** Keyed hashes of the submitting network and client; null once purged, and then never matched. */
  origin: { network: string | null; client: string | null };
  artifactSha: string | null;
  links: string[];
  /** Standing earned on this topic by confirmed reports; zero until Phase C. */
  standing: number;
}

export interface GateSettings {
  threshold: number;
  cap: number;
  base: number;
  artifact: number;
  clusterMinutes: number;
}

export interface MemberVerdict {
  id: string;
  counted: boolean;
  weight: number;
  reasons: string[];
}

export interface GateResult {
  corroborated: boolean;
  /** Whether a counted member carries a document, photograph or recording: evidence, for releasing a held report. */
  evidenced: boolean;
  mass: number;
  members: MemberVerdict[];
}

/** A link as a source: scheme, host and path, without fragment or trailing slash. */
export function sourceOf(link: string): string {
  try {
    const url = new URL(link);
    return `${url.protocol}//${url.host.toLowerCase()}${url.pathname.replace(
      /\/+$/u,
      ''
    )}${url.search}`;
  } catch {
    return link.trim();
  }
}

export function weightOf(member: GateMember, settings: GateSettings): number {
  const raw =
    settings.base +
    (member.artifactSha ? settings.artifact : 0) +
    Math.max(0, member.standing);
  return Math.min(settings.cap, raw);
}

/**
 * Evaluates a report and its corroborations. Members are considered in the
 * order they were submitted: when two are not independent, the earlier one
 * counts and the later one does not.
 */
export function evaluateGate(
  members: readonly GateMember[],
  settings: GateSettings
): GateResult {
  const ordered = [...members].sort(
    (a, b) =>
      a.submittedAt.getTime() - b.submittedAt.getTime() ||
      (a.role === 'report' ? -1 : 1)
  );
  const counted: GateMember[] = [];
  const verdicts: MemberVerdict[] = [];
  for (const member of ordered) {
    const reasons: string[] = [];
    if (member.official) {
      reasons.push(
        'Material from an official is the official record; it does not count as community corroboration.'
      );
    }
    if (member.role === 'corroboration' && member.disclosedInterest) {
      reasons.push(
        'Its contributor disclosed an interest in this matter, so it cannot count as independent corroboration.'
      );
    }
    for (const earlier of counted) {
      if (earlier.contributorId === member.contributorId) {
        reasons.push(
          'It is from an account that already supports this report.'
        );
      } else if (
        (member.origin.network &&
          member.origin.network === earlier.origin.network) ||
        (member.origin.client && member.origin.client === earlier.origin.client)
      ) {
        reasons.push(
          'It came from the same network or device as another contribution to this report, so the two count as one.'
        );
      } else if (
        member.role === 'corroboration' &&
        earlier.role === 'corroboration' &&
        Math.abs(member.submittedAt.getTime() - earlier.submittedAt.getTime()) <
          settings.clusterMinutes * 60_000
      ) {
        reasons.push(
          `It arrived within ${settings.clusterMinutes} minutes of another corroboration of this report, so the two count as one.`
        );
      } else if (
        (member.artifactSha && member.artifactSha === earlier.artifactSha) ||
        member.links.some((link) =>
          earlier.links.some((other) => sourceOf(other) === sourceOf(link))
        )
      ) {
        reasons.push(
          'It rests on the same file or link as another contribution to this report, so the two count as one source.'
        );
      }
    }
    const unique = [...new Set(reasons)];
    if (unique.length) {
      verdicts.push({
        id: member.id,
        counted: false,
        weight: 0,
        reasons: unique,
      });
      continue;
    }
    counted.push(member);
    verdicts.push({
      id: member.id,
      counted: true,
      weight: weightOf(member, settings),
      reasons: [
        member.role === 'report'
          ? 'The report itself counts toward its corroboration.'
          : 'It counts as independent corroboration.',
      ],
    });
  }
  const mass =
    Math.round(
      verdicts.reduce((sum, verdict) => sum + verdict.weight, 0) * 1000
    ) / 1000;
  return {
    corroborated: mass + 1e-9 >= settings.threshold,
    evidenced: counted.some((member) => member.artifactSha !== null),
    mass,
    members: verdicts,
  };
}
