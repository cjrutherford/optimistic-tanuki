import {
  buildThreads,
  extractAgendaItems,
  isOutlineAgenda,
  agendaHeader,
  extractOutcome,
  meetingDateFromDocumentText,
  meetingDateFromTitle,
  meetingDocumentTitle,
  topicKey,
} from '../src/agenda.js';

const AUG24 =
  'Welcome and Call to Order: Invocation/Pledge: Roll Call: Approval of Minutes: July 27, 2026 ' +
  'Adoption of the Agenda: New Business: 1. Ripple Award – Shon McQueen 2. Public Works – Actuator ' +
  'Purchase from Consolidated Pipe 3. Sanitation Tipping Fee Increase 4. Discussion - FY 27 Millage Rate ' +
  'City Manager Report: Department Head Report: Public Comments: Rules of Decorum for the Public ' +
  '1. Each Speaker will be given 3 minutes to speak. 2. Each speaker will direct comments to the body. ' +
  'Closing Comments from Governing Body: Adjournment:';

describe('extractAgendaItems', () => {
  it('finds New Business numbered items', () => {
    const items = extractAgendaItems(AUG24).filter((i) => !i.procedural);
    const heads = items.map((i) => i.heading);
    expect(heads.some((h) => h.includes('Ripple Award'))).toBeTruthy();
    expect(heads.some((h) => h.includes('Actuator'))).toBeTruthy();
    expect(heads.some((h) => h.includes('Tipping Fee'))).toBeTruthy();
    expect(heads.some((h) => h.includes('Millage Rate'))).toBeTruthy();
  });
  it('marks decorum items procedural', () => {
    const items = extractAgendaItems(AUG24);
    const comments = items.filter((i) => /decorum/i.test(i.section));
    expect(comments.length > 0).toBeTruthy();
    expect(comments.every((i) => i.procedural)).toBeTruthy();
  });
});

const COLON_STYLE =
  'In compliance with the Americans with Disabilities Act, those requiring accommodation should notify the Clerk. ' +
  'Mayor, Pat Doe Councilman Lee Roe Jan Poe, City Attorney Welcome and Call to Order: Invocation/Pledge: Roll Call: ' +
  'Approval of Minutes: August 10, 2026 & August 24, 2026 Adoption of the Agenda: New Business: ' +
  '1. Fire Department Recognition for School Fire Response 2. Recovery Proclamation 3. Park Grant Resolution 26-03 ' +
  '4. Millage Rate Tentative Proposal 5. Discussion – Entertainment District City Manager Report: Department Head Report: ' +
  'Public Comments: Rules of Decorum for the Public 1. Each Speaker will be given 3 minutes to speak. ' +
  '2. Members of the audience will respect the rights of others. Closing Comments from Governing Body: ' +
  'Executive Session: (When an Executive Session is required, one will be called for the following issues: Personnel) Adjournment: ' +
  'CITY COUNCIL REGULAR SESSION MEETING AGENDA Monday September 14, 2026 at 6:00 PM City Council Chambers 100 Main Street Riverton, GA 31000';

const CAPS_STYLE =
  'AGENDA CITY OF RIVERTON COUNCIL WORKSHOP Tuesday, September 8, 2026 5:30 PM Council Chambers, 130 E. 1 st Street ' +
  'ZONING PUBLIC HEARING 1. Zoning Application PP26-0016 – Requesting to Amend the Overlay on Mill Road, Map & Parcel 0046 052 ' +
  'MEETING CALL TO ORDER APPROVAL OF THE AGENDA NEW BUSINESS 2. Resolution Setting the Millage Rate for 2026 (City Manager) ' +
  '3. Ordinance Proposing a Downtown Entertainment District (Main Street Director) OTHER BUSINESS 4. City Manager Report ' +
  '5. Mayor & Council Comments EXECUTIVE SESSION FOR LEGAL/PERSONNEL/REAL ESTATE (If Needed) ' +
  'DECORUM FOR COUNCIL MEETINGS Rules of Decorum for the Governing Body 1. Members of the governing body shall not use offensive comments. ' +
  '2. Members of the governing body shall only speak to the matter under consideration.';

const SPECIAL_CALLED =
  'AGENDA RIVERTON CITY COUNCIL SPECIAL CALLED MEETING Monday, September 14, 2026 5:30 PM Council Chambers, 130 E. 1 st Street ' +
  '1. Call to Order 2. Approval of the Agenda 3. Resolution Approving the Final Tax Digest & Setting the Millage Rate For 2026 ' +
  '4. Executive Session for Legal/Personnel/Real Estate (If Needed) NOTICE OF SPECIAL CALLED MEETING Pursuant to state law the ' +
  'council gives notice that a Special Called Meeting will be held on Monday, September 14, 2026, 5:30 p.m. at City Hall.';

describe('extractAgendaItems on real-world layouts', () => {
  it('keeps short items and never splits a heading at a clock time', () => {
    for (const text of [COLON_STYLE, CAPS_STYLE, SPECIAL_CALLED]) {
      for (const item of extractAgendaItems(text)) {
        expect(item.section).not.toMatch(/\d{4} \d$|^[a-z]|\d:\d/u);
        expect(item.heading).not.toMatch(
          /MEETING AGENDA|\d{1,2}:\d{2} ?[AP]M/u
        );
      }
    }
  });

  it('splits colon-heading agendas at known sections, not at roster names', () => {
    const items = extractAgendaItems(COLON_STYLE);
    const business = items.filter((item) => !item.procedural);
    expect(business.map((item) => item.heading)).toStrictEqual([
      '1. Fire Department Recognition for School Fire Response',
      '2. Recovery Proclamation',
      '3. Park Grant Resolution 26-03',
      '4. Millage Rate Tentative Proposal',
      '5. Discussion – Entertainment District',
    ]);
    expect(
      business.every((item) => item.section === 'New Business')
    ).toBeTruthy();
    expect(
      items
        .filter((item) => /decorum/i.test(item.section))
        .every((item) => item.procedural)
    ).toBeTruthy();
    expect(
      !items.some((item) => /Riverton, GA|Main Street Riverton/.test(item.body))
    ).toBeTruthy();
  });

  it('splits ALL-CAPS agendas and keeps numbering across sections', () => {
    const items = extractAgendaItems(CAPS_STYLE);
    const business = items.filter((item) => !item.procedural);
    expect(business.map((item) => [item.section, item.ordinal])).toStrictEqual([
      ['ZONING PUBLIC HEARING', 1],
      ['NEW BUSINESS', 2],
      ['NEW BUSINESS', 3],
    ]);
    expect(business[0]!.body).toMatch(/Map & Parcel 0046 052$/u);
    expect(
      items
        .filter((item) => item.section === 'OTHER BUSINESS')
        .map((item) => item.procedural)
    ).toStrictEqual([true, true]);
  });

  it('reads numbered items after a meeting header and treats the notice as procedural', () => {
    const items = extractAgendaItems(SPECIAL_CALLED);
    expect(
      items.filter((item) => !item.procedural).map((item) => item.heading)
    ).toStrictEqual([
      '3. Resolution Approving the Final Tax Digest & Setting the Millage Rate For 2026',
    ]);
    expect(
      items.some((item) => /^NOTICE/.test(item.section) && item.procedural)
    ).toBeTruthy();
  });
});

describe('topicKey', () => {
  it('prefers case IDs', () => {
    expect(topicKey('Rezoning R-2026-04 Hwy 129')).toBe('case:r202604');
    expect(topicKey('Case CU-2026-11 RV park')).toBe('case:cu202611');
  });
  it('slugs keywords otherwise', () => {
    expect(topicKey('Sanitation Tipping Fee Increase')).toBe(
      'topic:sanitation-tipping-fee-increase'
    );
  });
});

describe('extractOutcome', () => {
  it('prefers decision sentences, falls back to first', () => {
    expect(
      extractOutcome(
        'The board heard remarks. Eric Gaither moved to approve, passed 6-0. Meeting adjourned.'
      )
    ).toBe('Eric Gaither moved to approve, passed 6-0.');
    expect(extractOutcome('No decisions at all here')).toBe(
      'No decisions at all here'
    );
  });
});

describe('meetingDateFromTitle', () => {
  it('parses both formats', () => {
    expect(meetingDateFromTitle('Minutes 07/27/2026')).toBe('2026-07-27');
    expect(meetingDateFromTitle('August 24, 2026 Agenda')).toBe('2026-08-24');
    expect(meetingDateFromTitle('No date here')).toBe(null);
  });
});

describe('buildThreads', () => {
  it('retains topic:general rows for canonical storage but excludes them from full-story selection', () => {
    const threads = buildThreads([
      {
        topicKey: 'topic:general',
        meetingDate: '2026-09-01',
        heading: 'General notice',
        body: 'A general notice',
        itemTitle: 'Agenda',
        uris: [],
      },
    ]);
    expect(threads.length).toBe(1);
    expect(threads[0].topicKey).toBe('topic:general');
  });

  it('groups by topic and links same-meeting items', () => {
    const threads = buildThreads([
      {
        topicKey: 'topic:water-rates',
        meetingDate: '2026-08-10',
        heading: 'Water rates vote',
        body: 'vote water rates',
        itemTitle: 'Aug 10 Agenda',
        uris: [],
      },
      {
        topicKey: 'topic:water-rates',
        meetingDate: '2026-08-24',
        heading: 'Water rates second reading',
        body: 'second reading water rates',
        itemTitle: 'Aug 24 Agenda',
        uris: [],
      },
      {
        topicKey: 'topic:millage-rate',
        meetingDate: '2026-08-24',
        heading: 'Millage rate',
        body: 'millage',
        itemTitle: 'Aug 24 Agenda',
        uris: [],
      },
    ]);
    expect(threads.length).toBe(2);
    const water = threads.find((t) => t.topicKey === 'topic:water-rates');
    expect(water?.items.length).toBe(2);
    expect(water?.meetings).toStrictEqual(['2026-08-10', '2026-08-24']);
    expect(
      water?.related.some((r) => r.topicKey === 'topic:millage-rate')
    ).toBeTruthy();
  });
  it('merges groups sharing a case ID', () => {
    const threads = buildThreads([
      {
        topicKey: 'topic:rv-park-merritt',
        meetingDate: '2026-09-01',
        heading: 'RV park proposal',
        body: 'Case CU-2026-11 discussed',
        itemTitle: 'A',
        uris: [],
      },
      {
        topicKey: 'case:cu202611',
        meetingDate: '2026-10-06',
        heading: 'Hearing',
        body: 'Hearing for CU-2026-11',
        itemTitle: 'B',
        uris: [],
      },
    ]);
    expect(threads.length).toBe(1);
    expect(threads[0].items.length).toBe(2);
  });
});

describe('meeting dates and titles from documents', () => {
  it('rejects digit runs that are not calendar dates', () => {
    expect(meetingDateFromTitle('Document 10/93/2063')).toBe(null);
    expect(meetingDateFromTitle('109363')).toBe(null);
    expect(meetingDateFromTitle('Minutes 07/27/2026')).toBe('2026-07-27');
    expect(meetingDateFromTitle('Agenda - Regular Session - 09.14.26')).toBe(
      '2026-09-14'
    );
    expect(meetingDateFromTitle('Board of Education August 24, 2026')).toBe(
      '2026-08-24'
    );
  });

  it('reads the meeting date from a cover page and ignores the printing date', () => {
    const text = [
      'Town of Groton, Connecticut Page 1 Printed on 09/14/2026',
      'Town of Groton, Connecticut Athletic Fields Task Force Meeting Agenda',
      '45 Fort Hill Road Groton, CT 06340',
      'Thursday, September 17, 2026 7:00 PM Virtual Meeting via Zoom',
      '1. CALL TO ORDER 2. ROLL CALL',
    ].join('\n');
    expect(meetingDateFromDocumentText(text)).toBe('2026-09-17');
    expect(meetingDocumentTitle(text)).toBe(
      'Athletic Fields Task Force Meeting Agenda 2026-09-17'
    );
  });

  it('names the body when the platform prints it after the document type', () => {
    const text =
      'Town of Groton, Connecticut Page 1 Town of Groton, Connecticut Regular Meeting Agenda Trails Coordinating Task Force Parks and Recreation 27 Spicer Avenue Noank, CT 06340 Thursday, September 17, 2026 4:00 PM';
    expect(meetingDocumentTitle(text)).toBe(
      'Trails Coordinating Task Force Regular Meeting Agenda 2026-09-17'
    );
  });

  it('keeps connector words inside a body name', () => {
    expect(
      meetingDocumentTitle(
        'Town of Groton, Connecticut Page 1 Town of Groton, Connecticut Town Council Committee of the Whole Regular Meeting Agenda Tuesday, September 22, 2026 6:00 PM'
      )
    ).toBe(
      'Town Council Committee of the Whole Regular Meeting Agenda 2026-09-22'
    );
    expect(
      meetingDocumentTitle(
        'Town of Groton, Connecticut Regular Meeting Agenda Parks and Recreation Advisory Committee 27 Spicer Avenue Wednesday, September 23, 2026'
      )
    ).toBe(
      'Parks and Recreation Advisory Committee Regular Meeting Agenda 2026-09-23'
    );
  });

  it('has no title for a document that is not a meeting record', () => {
    expect(
      meetingDocumentTitle(
        'Annual budget summary for fiscal year 2027. Revenue by fund.'
      )
    ).toBe(null);
  });
});

describe('outline agendas (I. / VII.1. / VIII.A.)', () => {
  const wetlands =
    'Town of Groton, Connecticut Inland Wetlands Agency Regular Meeting Agenda Wednesday, September 23, 2026 7:00 PM Town Hall Annex I. ROLL CALL I.1. Roll Call IV. PUBLIC COMMUNICATIONS IV.1. Public Communications VI. NEW APPLICATIONS VI.1. Receipt of New Applications VII. PENDING APPLICATIONS VII.1. IWA26-0008 Jones Residence Permit Modification, 183 Oslo Street IX. NEW BUSINESS IX.1. Report of Chair IX.2. Report of Staff X. ADJOURNMENT X.1. Adjournment Next Regular Meeting: 10/14/2026';
  const parks =
    "Regular Meeting Agenda Parks and Recreation Commission Chair Michael DiFranco, Elizabeth Hogan Wednesday, September 23, 2026 4:00 PM I. Call to Order II. Roll Call III. Approval of Meeting Minutes: III.A. PRC 8.26 Meeting Minutes IV. Citizens' Petitions and Comments VIII. Unfinished Business VIII.A. Food Supervisor VIII.B. David Jones Board Application IX. New Business IX.A. Memorial Benches X. Next Meeting Date: XI. Adjournment";
  const empty =
    'Zoning Board of Appeals Regular Meeting Agenda Wednesday, September 23, 2026 7:00 PM I. ROLL CALL II. PUBLIC HEARING(S) III. CONSIDERATION OF PUBLIC HEARING(S) IV. CORRESPONDENCE V. APPROVAL OF MINUTES VI. OLD BUSINESS VII. NEW BUSINESS VIII. REPORT OF STAFF IX. ADJOURNMENT';
  const business = (text: string) =>
    extractAgendaItems(text)
      .filter((row) => !row.procedural)
      .map((row) => `${row.section} | ${row.heading}`);

  it('finds the business under each section, even when roll call comes first', () => {
    expect(business(wetlands)).toStrictEqual([
      'PENDING APPLICATIONS | IWA26-0008 Jones Residence Permit Modification, 183 Oslo Street',
    ]);
    expect(business(parks)).toStrictEqual([
      'Unfinished Business | Food Supervisor',
      'Unfinished Business | David Jones Board Application',
      'New Business | Memorial Benches',
    ]);
  });

  it('keeps the roster and meeting logistics in a procedural preamble', () => {
    const [preamble] = extractAgendaItems(parks);
    expect(preamble?.section).toBe('Preamble');
    expect(preamble?.procedural).toBe(true);
    expect(preamble!.body).toMatch(/4:00 PM/);
  });

  it('yields no business for an agenda of empty headings', () => {
    expect(business(empty)).toStrictEqual([]);
    expect(isOutlineAgenda(empty)).toBe(true);
  });

  it('reads lettered items under a numeral', () => {
    const beach =
      'Beach & Parks Committee AGENDA Monday, September 21, 2026 I. ROLL CALL II. MINUTES APPROVAL III. CORRESPONDENCE V. OLD BUSINESS a. Social Media b. Farmers Market – September 15th VI. NEW BUSINESS VII. ADJOURNMENT';
    expect(business(beach)).toStrictEqual([
      'OLD BUSINESS | Social Media',
      'OLD BUSINESS | Farmers Market – September 15th',
    ]);
  });

  it('gives a row the header of its agenda — body, time, place — and none of the other rows', () => {
    const header = agendaHeader(parks);
    expect(header).toMatch(/Parks and Recreation Commission/);
    expect(header).toMatch(/4:00 PM/);
    expect(header).not.toMatch(/David Jones|Memorial Benches/);
    expect(
      agendaHeader(
        'CITY COUNCIL AGENDA Monday, September 14, 2026 1. Millage Rate 2. Ripple Award – Shon McQueen'
      )
    ).not.toMatch(/McQueen/);
  });

  it("drops an agenda header's standard notices and keeps who, when and where", () => {
    const header = agendaHeader(
      'Escambia County is committed to making our website accessible. If you use assistive technology, please contact our ADA Coordinator at 850-595-1637. AGENDA Second Budget Public Hearing September 24, 2026 5:01 P.M. Ernie Lee Magaha Government Building 1. Call to Order 2. Pledge'
    );
    expect(header).not.toMatch(/accessible|ADA|595-1637/);
    expect(header).toMatch(/Second Budget Public Hearing September 24, 2026/);
    expect(header).toMatch(/Ernie Lee Magaha Government Building/);
  });

  it('does not read a stray numeral in prose as an outline', () => {
    expect(
      isOutlineAgenda(
        '1. Call to Order 2. Invocation by Rev. John V. Smith 3. Pledge 4. Consent Agenda'
      )
    ).toBe(false);
  });
});
