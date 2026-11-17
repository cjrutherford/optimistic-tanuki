const test = require('node:test');
const assert = require('node:assert/strict');
const {
  censusQuery,
  createRateLimiter,
  evaluateOfficialPage,
  fetchOfficialPage,
  geocodeCensus,
  parseCensusResponse,
  parseRobots,
  robotsAllow,
  robotsAllowsPath,
} = require('../src/address-evidence');

test('builds a US Census query and refuses non-US addresses', () => {
  assert.equal(
    censusQuery({
      freeform: '340 Norman Dr',
      locality: 'Valdosta',
      region: 'GA',
      postcode: '31601',
      country: 'US',
    }),
    '340 Norman Dr, Valdosta, GA 31601'
  );
  assert.equal(
    censusQuery({ freeform: '1 Main St', country: 'CA' }),
    null
  );
});

test('parses unique, missing and ambiguous Census responses', () => {
  const unique = parseCensusResponse({
    result: {
      addressMatches: [
        {
          matchedAddress: '340 NORMAN DR, VALDOSTA, GA, 31601',
          coordinates: { x: -83.32, y: 30.83 },
        },
      ],
    },
  });
  assert.equal(unique.status, 'match');
  assert.equal(unique.precision, 'range');
  assert.deepEqual(unique.coordinates, { lat: 30.83, lng: -83.32 });

  assert.equal(
    parseCensusResponse({ result: { addressMatches: [] } }).status,
    'no_match'
  );
  assert.equal(
    parseCensusResponse({
      result: { addressMatches: [{}, {}] },
    }).status,
    'ambiguous'
  );
});

test('geocodes through the Census client with an injected fetch', async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        result: {
          addressMatches: [
            {
              matchedAddress: '10 MAIN ST, VALDOSTA, GA, 31601',
              coordinates: { x: -83, y: 31 },
            },
          ],
        },
      }),
      { status: 200 }
    );

  const result = await geocodeCensus({
    address: {
      freeform: '10 Main St',
      locality: 'Valdosta',
      region: 'GA',
      postcode: '31601',
    },
    fetchImpl,
    now: new Date('2026-11-10T00:00:00.000Z'),
  });

  assert.equal(result.status, 'match');
  assert.equal(result.provider, 'census');
  assert.equal(result.checkedAt, '2026-11-10T00:00:00.000Z');
});

test('parses robots rules and applies the longest match', () => {
  const rules = parseRobots(`
    User-agent: *
    Disallow: /private
    Allow: /private/public
    Disallow: /all
  `);
  assert.equal(robotsAllowsPath('/private/public/page', rules), true);
  assert.equal(robotsAllowsPath('/private/other', rules), false);
  assert.equal(robotsAllowsPath('/all/page', rules), false);
  assert.equal(robotsAllowsPath('/public', rules), true);
});

test('blocks a page when robots.txt disallows it', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/robots.txt')) {
      return new Response('User-agent: *\nDisallow: /store\n', {
        status: 200,
      });
    }
    throw new Error('page fetch should not run');
  };

  const result = await fetchOfficialPage({
    url: 'https://fixture.example.test/store/1',
    source: { name: 'Fixture', address: '10 Main St' },
    fetchImpl,
  });

  assert.equal(result.status, 'blocked');
});

test('extracts matching JSON-LD evidence', () => {
  const html = `
    <html><head>
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": "Fixture Bakery",
      "address": {
        "@type": "PostalAddress",
        "streetAddress": "10 Main St",
        "addressLocality": "Valdosta",
        "addressRegion": "GA",
        "postalCode": "31601"
      },
      "telephone": "+1 912-555-0100",
      "url": "https://fixture.example.test"
    }
    </script>
    </head><body>Fixture Bakery</body></html>
  `;
  const result = evaluateOfficialPage({
    url: 'https://fixture.example.test/locations/main-st',
    finalUrl: 'https://fixture.example.test/locations/main-st',
    body: html,
    source: {
      name: 'Fixture Bakery',
      address: '10 Main St',
      phone: '+19125550100',
      website: 'https://fixture.example.test',
    },
  });

  assert.equal(result.status, 'fetched');
  assert.equal(result.nameMatch, true);
  assert.equal(result.addressMatch, true);
  assert.equal(result.phoneMatch, true);
  assert.equal(result.websiteMatch, true);
  assert.equal(result.evidenceHash.length, 64);
});

test('marks mismatched page evidence as not matching', () => {
  const result = evaluateOfficialPage({
    url: 'https://fixture.example.test/other',
    body: '<html><body>Other Shop, 99 Other Rd, 000-000-0000</body></html>',
    source: {
      name: 'Fixture Bakery',
      address: '10 Main St',
      phone: '+19125550100',
      website: 'https://fixture.example.test',
    },
  });

  assert.equal(result.nameMatch, false);
  assert.equal(result.addressMatch, false);
  assert.equal(result.phoneMatch, false);
});

test('allows bounded HTTP evidence with a transport label', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/robots.txt')) {
      return new Response('', { status: 404 });
    }
    return new Response(
      '<html><body>Fixture Bakery 10 Main St 912-555-0100</body></html>',
      { status: 200 }
    );
  };

  const result = await fetchOfficialPage({
    url: 'http://fixture.example.test/locations/main-st',
    source: {
      name: 'Fixture Bakery',
      address: '10 Main St',
      phone: '+19125550100',
      website: 'http://fixture.example.test',
    },
    fetchImpl,
  });

  assert.equal(result.status, 'fetched');
  assert.equal(result.transport, 'http');
  assert.equal(result.nameMatch, true);
  assert.equal(result.addressMatch, true);
});

test('classifies bot challenges as blocked', async () => {
  const fetchImpl = async (url) => {
    if (String(url).endsWith('/robots.txt')) {
      return new Response('', { status: 404 });
    }
    return new Response('<html><title>Robot or human?</title></html>', {
      status: 200,
    });
  };

  const result = await fetchOfficialPage({
    url: 'https://fixture.example.test/store/1',
    source: { name: 'Fixture Bakery', address: '10 Main St' },
    fetchImpl,
  });

  assert.equal(result.status, 'blocked');
});

test('rate limiter spaces calls', async () => {
  const limiter = createRateLimiter(5);
  const start = Date.now();
  await limiter();
  await limiter();
  assert.ok(Date.now() - start >= 4);
});
