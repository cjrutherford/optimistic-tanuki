import { projectForumContent } from './account-export-content';

describe('Forum account export content projection', () => {
  it('keeps unicode as inert text and emits only canonical opaque asset references', () => {
    expect(projectForumContent('こんにちは 🙂')).toEqual({
      text: 'こんにちは 🙂',
      markup: [],
      resources: [],
    });
    expect(
      projectForumContent(
        '<p>body<img src="/api/asset/123e4567-e89b-42d3-a456-426614174000" alt="local"></p>'
      )
    ).toMatchObject({
      text: 'body',
      resources: [
        {
          kind: 'asset',
          assetId: '123e4567-e89b-42d3-a456-426614174000',
          status: 'referenceOnly-unverified',
        },
      ],
    });
  });

  it.each([
    '<IMG SRC=x>',
    '<a href="https://exa&#10;mple.test">x</a>',
    '<img src="https://example.test/x"alt="adjacent">',
    '<p/>unsupported',
    '<a href="javascript:alert(1)">x</a>',
    '<a href="JaVaScRiPt:alert(1)">x</a>',
    '<a href="&#x6a;avascript:alert(1)">x</a>',
    '<a href="https://u:p@example.test/a">x</a>',
    '<a href="https://example.test/a?q=1">x</a>',
    '<img src="file:///tmp/a">',
    '<img src="//example.test/a">',
    '<img src="https://a/x" srcset="https://b/y 2x">',
  ])('rejects unsupported or unsafe resource syntax: %s', (input) => {
    expect(() => projectForumContent(input)).toThrow();
  });

  it('rejects unknown and malformed entities instead of dropping them', () => {
    expect(() => projectForumContent('x &madeup;')).toThrow(
      'FORUM_EXPORT_INVALID_ENTITY'
    );
    expect(projectForumContent('x &amp; y').text).toBe('x & y');
  });
  it('rejects a long malformed attribute tail without permissive tag parsing', () => {
    expect(() =>
      projectForumContent('<p ' + ' '.repeat(20000) + 'invalid>text</p>')
    ).toThrow();
  });
});
