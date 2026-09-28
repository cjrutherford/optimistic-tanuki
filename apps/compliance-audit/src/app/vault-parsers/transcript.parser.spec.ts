import { parseTranscript } from './transcript.parser';

const DEPOSITION = `TRANSCRIPT OF PROCEEDINGS
BEFORE THE HONORABLE MARCIA L. THORNE
UNITED STATES DISTRICT COURT
NORTHERN DISTRICT OF CALIFORNIA

Case No. 3:24-cv-01842-JLT
THORNE v. MERIDIAN LOGISTICS, INC.
Date: March 14, 2025
Volume I, Pages 1-214
Reported by: R. Alvarez, CSR No. 8412

APPEARANCES:
PLAINTIFF MERIDIAN LOGISTICS, INC.
By: Ana Ortiz, Esq.
Counsel for Plaintiff

DEFENDANT THORNE
By: David Kim, Esq.
Counsel for Defendant

THE WITNESS:
Q.  Please state your full name for the record.
A.  Gerald M. Thorne.

MR. KIM:
Q.  You were the custodian of records at the Shreveport yard?
A.  That's right.

                 [Exhibit 12 marked for identification]

--- 2 ---
Q.  Turn to the production page 44, please.
A.  I cannot recall without the document.
MR. KIM:
Q.  You testified in your declaration that it was destroyed in 2021.
                 (Exhibit No. 3)
A.  I did not say destroyed.
THE WITNESS:
Q.  Then say what you said.
`;

describe('parseTranscript', () => {
  const parsed = parseTranscript(DEPOSITION);

  it('reads the case caption and number off the header', () => {
    expect(parsed.caseNumber).toBe('3:24-cv-01842-JLT');
    expect(parsed.caseCaption).toBe('THORNE v. MERIDIAN LOGISTICS, INC.');
  });

  it('reads the hearing date and reporter certification', () => {
    expect(parsed.date).toBe('2025-03-14');
    expect(parsed.reporter).toBe('R. Alvarez');
    expect(parsed.certificationNumber).toBe('8412');
    expect(parsed.volume).toBe('I');
  });

  it('reads the appearances block into party and counsel pairs', () => {
    expect(parsed.appearances).toEqual([
      {
        party: 'PLAINTIFF MERIDIAN LOGISTICS, INC.',
        counsel: 'Ana Ortiz, Esq.',
      },
      { party: 'DEFENDANT THORNE', counsel: 'David Kim, Esq.' },
    ]);
  });

  it('attributes a bare Q/A to the witness who is on the stand', () => {
    const first = parsed.turns[0];
    expect(first.speaker).toBe('THE WITNESS');
    expect(first.role).toBe('question');
    expect(first.text).toBe('Please state your full name for the record.');
    expect(first.page).toBe(1);
  });

  it('reads the answer as an answer rather than as a new speaker', () => {
    const answer = parsed.turns[1];
    expect(answer.speaker).toBe('THE WITNESS');
    expect(answer.role).toBe('answer');
    expect(answer.text).toBe('Gerald M. Thorne.');
  });

  it('attributes a named counsel line to that counsel', () => {
    const kim = parsed.turns.find(
      (turn) =>
        turn.speaker === 'MR. KIM' &&
        turn.text.includes('custodian of records at the Shreveport yard')
    );
    expect(kim).toBeDefined();
    expect(kim?.role).toBe('question');
    expect(kim?.page).toBe(1);
  });

  it('carries the last named speaker across a page break', () => {
    const onPageTwo = parsed.turns.filter((turn) => turn.page === 2);
    expect(
      onPageTwo.some((turn) => turn.text.startsWith('Turn to the production'))
    ).toBe(true);
    expect(
      onPageTwo.find((turn) => turn.text.startsWith('Turn to the production'))
        ?.speaker
    ).toBe('MR. KIM');
  });

  it('moves later turns onto the page marker that precedes them', () => {
    expect(parsed.turns[0].page).toBe(1);
    expect(parsed.turns[parsed.turns.length - 1].page).toBe(2);
  });

  it('collects exhibit markers rather than dropping them into a turn', () => {
    expect(parsed.exhibits).toEqual([
      { number: 12, marker: '[Exhibit 12 marked for identification]' },
      { number: 3, marker: '(Exhibit No. 3)' },
    ]);
  });

  it('reports the counts a reviewer needs to know the record is complete', () => {
    expect(parsed.pageCount).toBe(2);
    expect(parsed.turnCount).toBe(9);
    expect(parsed.exhibitCount).toBe(2);
  });

  it('never treats a bare speaker heading as spoken testimony', () => {
    expect(parsed.turns.some((turn) => turn.text === 'THE WITNESS:')).toBe(
      false
    );
  });

  it('refuses to invent a caption from a transcript that has none', () => {
    const sparse = parseTranscript('Q.  Anything?\nA.  No.');
    expect(sparse.caseCaption).toBeNull();
    expect(sparse.caseNumber).toBeNull();
    expect(sparse.date).toBeNull();
    expect(sparse.reporter).toBeNull();
    expect(sparse.appearances).toEqual([]);
  });

  it('returns no turns for empty input instead of throwing', () => {
    const empty = parseTranscript('');
    expect(empty.turns).toEqual([]);
    expect(empty.turnCount).toBe(0);
    expect(empty.pageCount).toBe(0);
    expect(empty.exhibitCount).toBe(0);
  });

  it('recognises the court and the clerk as speakers distinct from counsel', () => {
    const hearing = parseTranscript(
      [
        'THE COURT:  Order in the court.',
        'THE CLERK:  Are there any objections?',
        'MR. KIM:  None from our side.',
      ].join('\n')
    );

    expect(hearing.turns.map((turn) => turn.speaker)).toEqual([
      'THE COURT',
      'THE CLERK',
      'MR. KIM',
    ]);
    expect(hearing.turns[0].role).toBe('the-court');
    expect(hearing.turns[1].role).toBe('the-clerk');
    expect(hearing.turns[2].role).toBe('counsel');
  });

  it('strips a reporter line-number gutter without eating the testimony', () => {
    const numbered = parseTranscript(
      ['1  Q.  Did you sign the manifest?', '2  A.  I did, on the 3rd.'].join(
        '\n'
      )
    );

    expect(numbered.turns[0]).toEqual(
      expect.objectContaining({ line: 1, text: 'Did you sign the manifest?' })
    );
    expect(numbered.turns[1]).toEqual(
      expect.objectContaining({ line: 2, text: 'I did, on the 3rd.' })
    );
  });

  it('folds an unwrapped continuation line into the turn it belongs to', () => {
    const wrapped = parseTranscript(
      [
        'MR. KIM:',
        'Q.  Describe the yard layout, and be',
        '   specific about the north gate.',
        'A.  It is fenced.',
      ].join('\n')
    );

    expect(wrapped.turns[0].text).toBe(
      'Describe the yard layout, and be specific about the north gate.'
    );
    expect(wrapped.turns[1].text).toBe('It is fenced.');
  });

  it('keeps a page marker written as a bare number', () => {
    const paged = parseTranscript(
      ['Q.  First question.', '7', 'Q.  Question on page seven.'].join('\n')
    );

    expect(paged.turns[0].page).toBe(1);
    expect(paged.turns[1].page).toBe(7);
  });

  it('reads a "Page N" marker form', () => {
    const paged = parseTranscript(
      ['Q.  First question.', 'Page 12', 'Q.  Question on page twelve.'].join(
        '\n'
      )
    );

    expect(paged.turns[1].page).toBe(12);
  });

  it('reads an ISO date written on the date line', () => {
    const iso = parseTranscript('Date: 2024-11-02\nQ.  Anything?');
    expect(iso.date).toBe('2024-11-02');
  });
});
