# Daylight source discovery benchmark (P1.7)

Date: 2026-10-01. Slice P1.7 of
`2026-09-30-daylight-civic-briefing-integration.md`. This measures the
source discovery ported from the POC (`discoverSources` in
`libs/civic/core/src/sourcing.ts`) before any of the new channels
(SD.1–SD.4) are built, so their order rests on evidence.

## Method

- **Offline.** The POC's own decision log
  (`daylight-poc/data/sources/decisions.jsonl`: 11 runs and 286 decisions on
  2026-09-23/25, all with SearXNG) is broken down by refusal reason and host.
- **Live, blind.** For each edition town, the ported code runs with
  `existing: []`, so none of the hand-written sources are visible.
  - It uses the same directory inputs as the POC: the .gov list and the
    Wikidata answers cached on 2026-09-23/25.
  - It crawls live, up to 150 pages per town, honouring robots.txt.
  - Harness: `libs/civic/adapters/benchmark/discovery.bench.ts`, target
    `nx run civic-adapters:discovery-benchmark` (on demand only; live
    network).
- **Ground truth.** The enabled hand-written sources of the town and of the
  local governments around it (town, city, county, school district), which
  is the scope discovery searches. The 19 regional, state and NWS sources are
  outside that scope by design and are not scored.
- **Search.** The owner asked for runs with and without SearXNG. Only the
  no-search run took place; see "Search is not available" below.

## Results (no search, 2026-10-01)

| Town          | Pages | Seconds | In-scope hand sources | Found | Near-miss | Missed | Adopted |
| ------------- | ----- | ------- | --------------------- | ----- | --------- | ------ | ------- |
| adel-ga       | 44    | 79      | 2                     | 0     | 0         | 2      | 0       |
| ferry-pass-fl | 31    | 21      | 1                     | 0     | 1         | 0      | 1       |
| groton-ct     | 150   | 151     | 4                     | 1     | 0         | 3      | 1       |
| madison-fl    | 52    | 86      | 3                     | 0     | 0         | 3      | 0       |
| nashville-ga  | 35    | 76      | 3                     | 2     | 0         | 1      | 2       |
| tifton-ga     | 99    | 247     | 3                     | 1     | 1         | 1      | 2       |

**Recall:** 6 of 16 (38%), counting 4 exact or same-host matches and 2
near-misses.

- **Near-misses.** Ferry Pass's adopted `escambiacofl.civicclerk.com` is the
  same CivicClerk tenant as the hand-written `escambiacofl.portal.civicclerk.com`.
  Tifton's adopted `tiftonga.gov/AgendaCenter` is the agenda center that the
  hand-written `tifton.net/AgendaCenter` redirects to.
- **Precision.** All 6 adoptions were plausible: each was on a hand source's
  host or was one of those near-misses. Nothing wrong was adopted.
- **Refusals were mostly correct.**
  - 43 of 49 refusals are board pages inside an agenda center that had
    already been adopted whole.
  - The rest are candidates whose trial reads found no recent dated items.
- **Compared with the POC.** Its own 286 logged decisions (with search)
  adopted 3 sources, all from Tifton.

## What the 10 true misses need

| Category                       | Misses | Sources                                                                                                                           | Channel that addresses it                                                          |
| ------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Local news                     | 4      | CT Examiner (Groton), Tifton Gazette, Greene Publishing and WTXL (Madison)                                                        | SD.3 legal organs and RSS autodiscovery, plus search                               |
| Bespoke government pages       | 4      | Adel agendas, Madison agendas (Word files), Berrien commission minutes, Groton news list                                          | SD.4 model-proposed scrape config; Adel may be found once bugs B1 and B2 are fixed |
| Platform not recognised        | 1      | Groton's AgendaSuite (`agendasuite.org/iip/groton`); `detect.ts` knows Legistar, Granicus, CivicClerk, CivicPlus and Apptegy only | SD.2 tenant probing, adding AgendaSuite                                            |
| School board on its own domain | 1      | Cook County Schools board (`cook.k12.ga.us`)                                                                                      | SD.1 Census spine, with school districts as places                                 |

## Bugs found

- **B1: the .gov match misses state-suffixed names.** `dotgovSitesFor`
  requires a city's organisation to be exactly "City of Adel", but the .gov
  list registers it as "City of Adel, GA". `cityofadelga.gov` was therefore
  never seeded.
- **B2: own-site domain moves are dead ends.** Wikidata's `cityofadel.us`
  and `tifton.net` both redirect (302) to a different domain. The outbound
  policy refuses cross-origin redirects, so a crawl seeded on the old domain
  stalls. Tifton recovered only because the .gov list also had the new
  domain; Adel didn't, because of B1.
- **B3: the scorer under-counts.** Matching by host misses the same
  CivicClerk tenant under a different subdomain. This is a benchmark
  limitation, fixed in the counts above by hand; it is not a discovery bug.

From the POC's logged runs (with search):

- **Search returns out-of-area candidates.** All 77 robots.txt refusals were
  for Jacksonville's council site, which search proposed for Ferry Pass, a
  different county. Search proposed other places too: Martins Ferry OH,
  Berrien County MI and Nashville TN. The same-name check refused them
  correctly, but every one cost a fetch.
- **Real local sources failed the date check.** For Berrien County GA's own
  site and the Madison and Tift school sites (Apptegy), trial reads found
  items but no recent dates. That is either date parsing or stale pages, and
  it needs a look when those adapters are next touched.

## After fixing B1 and B2 (9f7cf863)

Adel and Tifton were re-run:

- **Adel.** It now seeds `cityofadelga.gov` from the .gov list (3 directory
  sites, up from 2), but still adopts nothing. Its agendas page,
  `/documents/agendas-minutes`, lists dated agenda PDFs under a Drupal file
  path that no recognised platform uses. That makes it a bespoke page
  (SD.4), not a seeding failure.
- **Tifton.** Unchanged. Its agenda center was already found through
  `tiftonga.gov`.
- **B2** has a regression test (a listed domain redirecting to the
  government's new one). It mattered less here than expected, because both
  towns' new domains were also in the .gov list once B1 was fixed.

Recall is unchanged at 6 of 16. The fixes remove two ways for a town to be
missed, but the misses in this sample need the new channels.

## Search is not available (D21)

The POC's SearXNG settings deliberately enable only engines that answer
automated queries without a challenge: DuckDuckGo, Mojeek and Wikipedia. On
2026-10-01 from this machine:

- DuckDuckGo answered with a CAPTCHA, and SearXNG suspended it.
- **Mojeek was never on.** SearXNG's defaults mark it `inactive: true`
  because it "uses a Proof of Work CAPTCHA". The POC's `keep_only` list keeps
  it in the engine list without activating it, so the POC's runs only ever
  had DuckDuckGo and Wikipedia. Enabling it would mean working around a bot
  defence, which the POC's rule excludes.
- Wikipedia is an encyclopedia engine and returns nothing useful for these
  queries.

So there was a configuration gap, but nothing to fix within the rules. The
"with search" comparison was not run, because it would have repeated the
no-search run.

**Decision (owner, D21):** discovery relies on the directories, the crawl
and the new channels (SD.1–SD.3). Search stays pluggable through
`SEARCH_PROVIDER`, off by default. SD.7 (a SearXNG compose service) is
dropped unless a challenge-free engine becomes available.

## Suggested order of work (for the owner to decide)

1. **Fix B1 and B2.** They are small. Adel's agendas may be found once the
   correct .gov domain seeds the crawl, and following same-government domain
   moves helps every town that has changed domains.
2. **SD.3, local news, is the largest category.** With search off (D21), it
   rests on the legal-organ lists and RSS autodiscovery.
3. **SD.4, bespoke government pages,** is the second largest. It is also the
   riskiest under full automation (D9).
4. **SD.2 (adding AgendaSuite to the probes) and SD.1 (school districts as
   places)** each recover one source in this sample.
