import {
  evaluateGate,
  sourceOf,
  type GateMember,
  type GateSettings,
} from '../src/gate.js';

const settings: GateSettings = {
  threshold: 1,
  cap: 0.5,
  base: 0.3,
  artifact: 0.2,
  clusterMinutes: 5,
};
const minute = (n: number) => new Date(Date.UTC(2026, 8, 14, 18, n));
let counter = 0;
const member = (overrides: Partial<GateMember> = {}): GateMember => {
  counter += 1;
  return {
    id: `m${counter}`,
    contributorId: `c${counter}`,
    role: 'corroboration',
    submittedAt: minute(counter * 10),
    official: false,
    disclosedInterest: null,
    origin: { network: `n${counter}`, client: `d${counter}` },
    artifactSha: null,
    links: [],
    standing: 0,
    ...overrides,
  };
};

describe('the corroboration gate', () => {
  it('is not crossed by a report alone, however strong', () => {
    const result = evaluateGate(
      [member({ role: 'report', artifactSha: 'a', standing: 5 })],
      settings
    );
    expect(result.mass).toBe(0.5);
    expect(result.corroborated).toBe(false);
  });

  it('is crossed by a report with a document and one independent corroboration with a document', () => {
    const result = evaluateGate(
      [
        member({ role: 'report', artifactSha: 'a' }),
        member({ artifactSha: 'b' }),
      ],
      settings
    );
    expect(result.corroborated).toBe(true);
    expect(result.evidenced).toBe(true);
  });

  it('is crossed by four independent plain accounts, not by three', () => {
    const three = [member({ role: 'report' }), member(), member()];
    expect(evaluateGate(three, settings).corroborated).toBe(false);
    expect(evaluateGate([...three, member()], settings).corroborated).toBe(
      true
    );
    expect(evaluateGate([...three, member()], settings).evidenced).toBe(false);
  });

  it('counts one account once', () => {
    const report = member({ role: 'report' });
    const again = member({ contributorId: report.contributorId });
    expect(evaluateGate([report, again], settings).members[1]!.counted).toBe(
      false
    );
  });

  it('collapses contributions from one network or device', () => {
    const report = member({ role: 'report' });
    const sameNetwork = member({
      origin: { network: report.origin.network, client: 'other' },
    });
    const sameDevice = member({
      origin: { network: 'elsewhere', client: report.origin.client },
    });
    const result = evaluateGate([report, sameNetwork, sameDevice], settings);
    expect(result.members.map((m) => m.counted)).toStrictEqual([
      true,
      false,
      false,
    ]);
    expect(result.members[1]!.reasons[0]!).toMatch(/same network or device/u);
  });

  it('never matches origins that have been purged', () => {
    const report = member({
      role: 'report',
      origin: { network: null, client: null },
    });
    const other = member({ origin: { network: null, client: null } });
    expect(evaluateGate([report, other], settings).members[1]!.counted).toBe(
      true
    );
  });

  it('collapses a burst of corroborations minutes apart', () => {
    const report = member({ role: 'report', submittedAt: minute(0) });
    const first = member({ submittedAt: minute(100) });
    const burst = member({ submittedAt: minute(102) });
    const later = member({ submittedAt: minute(110) });
    expect(
      evaluateGate([report, first, burst, later], settings).members.map(
        (m) => m.counted
      )
    ).toStrictEqual([true, true, false, true]);
  });

  it('collapses contributions resting on the same file or link', () => {
    const report = member({
      role: 'report',
      links: ['https://YouTube.com/watch?v=abc#t=30'],
    });
    const sameLink = member({ links: ['https://youtube.com/watch?v=abc'] });
    const sameFile = member({ artifactSha: 'x' });
    const alsoFile = member({ artifactSha: 'x' });
    expect(
      evaluateGate(
        [report, sameLink, sameFile, alsoFile],
        settings
      ).members.map((m) => m.counted)
    ).toStrictEqual([true, false, true, false]);
  });

  it("never counts an official's material or an interested corroborator", () => {
    const result = evaluateGate(
      [
        member({ role: 'report' }),
        member({ official: true, artifactSha: 'o' }),
        member({ disclosedInterest: 'I am the applicant' }),
      ],
      settings
    );
    expect(result.members.map((m) => m.counted)).toStrictEqual([
      true,
      false,
      false,
    ]);
    expect(result.evidenced).toBe(false);
  });

  it('normalises links as sources', () => {
    expect(sourceOf('https://Example.com/a/')).toBe(
      sourceOf('https://example.com/a#frag')
    );
  });
});
