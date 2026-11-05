import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agendaHtmlToText } from './agenda-source-discovery';
import {
  extractOfficials,
  normalizeOfficialName,
} from './officials-extraction';

const names = (text: string) =>
  extractOfficials(text).map((o) => `${o.role}: ${o.name}`);

describe('extractOfficials', () => {
  it('finds nobody in the Savannah fixture, which names no people', () => {
    const html = readFileSync(
      join(__dirname, 'fixtures', 'savannah-agenda.html'),
      'utf8'
    );
    expect(extractOfficials(agendaHtmlToText(html))).toEqual([]);
  });

  it('reads titled names, skipping the text that follows them', () => {
    const text = [
      'City of Savannah',
      'Mayor Van Johnson called the meeting to order.',
      'Mayor Pro Tem Linda Wilder-Bryan presented the proclamation.',
      'Alderman Kurtis Purtee moved approval; Alderwoman Alicia Miller Blakely seconded.',
      'Commissioner J. Martin Rivera reported.',
    ].join('\n');
    expect(names(text)).toEqual(
      expect.arrayContaining([
        'Mayor: Van Johnson',
        'Mayor Pro Tem: Linda Wilder-Bryan',
        'Alderman: Kurtis Purtee',
        'Alderman: Alicia Miller Blakely',
        'Commissioner: J. Martin Rivera',
      ])
    );
  });

  it('reads a plural title with a list of names', () => {
    expect(
      names(
        "Council Members Jane Smith, John Q. Doe and Mary O'Brien attended."
      )
    ).toEqual([
      'Council Member: Jane Smith',
      'Council Member: John Q. Doe',
      "Council Member: Mary O'Brien",
    ]);
  });

  it('reads a name followed by a title', () => {
    expect(
      names('Respectfully, Pat Lee, City Manager\nSam Poe, Mayor')
    ).toEqual(['Manager: Pat Lee', 'Mayor: Sam Poe']);
  });

  it('reads a roll call, with and without titles, and stops at Absent', () => {
    const text =
      'Council Members Present: Ann Archer, Bob Baker, Cy Cole, Absent: Dee Dunn';
    expect(names(text)).toEqual([
      'Council Member: Ann Archer',
      'Council Member: Bob Baker',
      'Council Member: Cy Cole',
    ]);
    expect(
      names('Present: Jane Smith, Mayor; John Doe, Council Member; Al Roe')
    ).toEqual([
      'Mayor: Jane Smith',
      'Council Member: John Doe',
      'Member: Al Roe',
    ]);
  });

  it('keeps one entry per person across spellings', () => {
    const found = extractOfficials(
      'Present: Jane Smith\nMayor Jane Smith presided.\nJane Smith Jr., Mayor'
    );
    expect(found).toEqual([{ name: 'Jane Smith', role: 'Mayor' }]);
  });

  it.each([
    "Presented to the Mayor's Office for review",
    'Mayor Street closure at 5th Avenue',
    'Commissioner Road resurfacing',
    'Council Member Comments',
    'Mayor Proclamation recognizing Girl Scouts',
    'Report from the City Manager on the budget',
    'Request to the Chair of the Planning Commission',
    'MAYOR JANE SMITH',
    'the mayor Jane Smith',
    'Present: Public Works Department',
    'Rezoning request for Mayor Hill Drive.',
  ])('does not take a name from %p', (text) => {
    expect(extractOfficials(text)).toEqual([]);
  });
});

describe('normalizeOfficialName', () => {
  it('ignores case, accents, punctuation and a generational suffix', () => {
    expect(normalizeOfficialName("José O'Brien Jr.")).toBe('jose o brien');
    expect(
      normalizeOfficialName('JOSE  OBRIEN'.replace('OBRIEN', "O'Brien"))
    ).toBe('jose o brien');
  });
});
