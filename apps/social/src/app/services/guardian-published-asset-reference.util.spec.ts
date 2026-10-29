import DOMPurify from 'isomorphic-dompurify';
import { guardianPublishedAssetReferences } from './guardian-published-asset-reference.util';

describe('guardianPublishedAssetReferences sanitizer contract', () => {
  it('fails closed if the sanitizer does not return a DOM fragment', () => {
    jest
      .spyOn(DOMPurify, 'sanitize')
      .mockReturnValueOnce(
        '<img src="/api/asset/123e4567-e89b-42d3-a456-426614174000">' as never
      );

    expect(
      guardianPublishedAssetReferences(
        '<img src="/api/asset/123e4567-e89b-42d3-a456-426614174000">'
      )
    ).toEqual(new Set());
  });

  it('fails closed if the sanitizer returns an invalid fragment shape', () => {
    jest
      .spyOn(DOMPurify, 'sanitize')
      .mockReturnValueOnce({ querySelectorAll: true } as never);

    expect(
      guardianPublishedAssetReferences(
        '<img src="/api/asset/123e4567-e89b-42d3-a456-426614174000">'
      )
    ).toEqual(new Set());
  });
});
