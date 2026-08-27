/**
 * Source health probe.
 *
 * Every active discovery source declares a `healthProbeUrl` in the registry.
 * This hits each one and reports what came back, so a feed that has quietly
 * died shows up as a failing check instead of a topic that silently stops
 * producing leads — which is exactly how JustRemote rotted unnoticed (its
 * jobs.xml started returning an HTML page and the provider parsed it as XML).
 *
 * Exit code is non-zero if any active source fails, so CI can gate on it.
 * `--all` also probes retired sources, for confirming they are still dead.
 */
import {
  ALL_LEAD_DISCOVERY_SOURCES,
  LeadDiscoverySourceDescriptor,
} from '@optimistic-tanuki/leads-contracts';

type ProbeOutcome = {
  descriptor: LeadDiscoverySourceDescriptor;
  status: 'ok' | 'unexpected-type' | 'http-error' | 'unreachable' | 'skipped';
  detail: string;
};

const TIMEOUT_MS = Number(process.env.PROBE_TIMEOUT_MS || 15000);
const includeRetired = process.argv.includes('--all');
const asJson = process.argv.includes('--json');

/** What each source's endpoint is supposed to hand back. */
const expectedContentType = (
  descriptor: LeadDiscoverySourceDescriptor
): RegExp =>
  descriptor.legalBasis === 'published-feed' ? /(xml|rss)/i : /(json)/i;

const probe = async (
  descriptor: LeadDiscoverySourceDescriptor
): Promise<ProbeOutcome> => {
  if (!descriptor.healthProbeUrl) {
    return {
      descriptor,
      status: 'skipped',
      detail: descriptor.requiresApiKey
        ? 'Keyed source; no unauthenticated probe available.'
        : 'No probe URL declared.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(descriptor.healthProbeUrl, {
      signal: controller.signal,
      headers: {
        'user-agent': 'OptimisticTanukiLeadDiscovery/1.0',
        accept: 'application/json, application/rss+xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      return {
        descriptor,
        status: 'http-error',
        detail: `HTTP ${response.status}`,
      };
    }

    // A 200 is not enough on its own. JustRemote returned 200 with an HTML
    // page where XML was expected, which is precisely the failure this catches.
    const contentType = response.headers.get('content-type') || '';
    if (!expectedContentType(descriptor).test(contentType)) {
      return {
        descriptor,
        status: 'unexpected-type',
        detail: `HTTP 200 but content-type was "${
          contentType || 'unknown'
        }" — expected ${
          descriptor.legalBasis === 'published-feed' ? 'a feed' : 'JSON'
        }`,
      };
    }

    const body = await response.text();
    return {
      descriptor,
      status: 'ok',
      detail: `HTTP 200 · ${contentType.split(';')[0]} · ${(
        body.length / 1024
      ).toFixed(0)} KB`,
    };
  } catch (error) {
    return {
      descriptor,
      status: 'unreachable',
      detail:
        error instanceof Error && error.name === 'AbortError'
          ? `No response within ${TIMEOUT_MS}ms`
          : error instanceof Error
          ? error.message
          : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};

const main = async () => {
  const targets = ALL_LEAD_DISCOVERY_SOURCES.filter(
    (descriptor) => includeRetired || descriptor.status === 'active'
  );

  const results = await Promise.all(targets.map(probe));

  if (asJson) {
    console.log(
      JSON.stringify(
        results.map((result) => ({
          id: result.descriptor.id,
          status: result.status,
          detail: result.detail,
        })),
        null,
        2
      )
    );
  } else {
    const marks: Record<ProbeOutcome['status'], string> = {
      ok: 'OK  ',
      'unexpected-type': 'BAD ',
      'http-error': 'FAIL',
      unreachable: 'DOWN',
      skipped: 'SKIP',
    };

    console.log('\nLead discovery source health\n');
    for (const result of results) {
      console.log(
        `  ${marks[result.status]}  ${result.descriptor.id.padEnd(16)} ${
          result.detail
        }`
      );
    }
  }

  // Skipped sources are a deliberate absence, not a failure — and a retired
  // source failing is the expected result, confirming the retirement still
  // holds rather than signalling a regression.
  const failures = results.filter(
    (result) =>
      result.descriptor.status === 'active' &&
      result.status !== 'ok' &&
      result.status !== 'skipped'
  );

  const retiredStillDead = results.filter(
    (result) => result.descriptor.status === 'retired' && result.status !== 'ok'
  );
  if (retiredStillDead.length) {
    console.log(
      `\n${retiredStillDead.length} retired source(s) confirmed still unusable.`
    );
  }
  const retiredRecovered = results.filter(
    (result) => result.descriptor.status === 'retired' && result.status === 'ok'
  );
  if (retiredRecovered.length) {
    console.log(
      `\nRetired source(s) now responding again — worth re-checking: ${retiredRecovered
        .map((result) => result.descriptor.id)
        .join(', ')}`
    );
  }

  if (failures.length) {
    console.error(
      `\n${failures.length} source(s) unhealthy: ${failures
        .map((failure) => failure.descriptor.id)
        .join(', ')}`
    );
    process.exit(1);
  }

  console.log('\nAll probed sources healthy.');
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
