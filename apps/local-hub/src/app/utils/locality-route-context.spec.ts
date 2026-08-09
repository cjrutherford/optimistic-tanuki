import { convertToParamMap } from '@angular/router';
import { localityRouteContext } from './locality-route-context';

describe('localityRouteContext', () => {
  it('normalizes city routes to the city base segments', () => {
    expect(localityRouteContext(convertToParamMap({ slug: 'austin' }))).toEqual(
      {
        slug: 'austin',
        baseSegments: ['/city', 'austin'],
      }
    );
  });

  it('normalizes community routes to the community base segments', () => {
    expect(
      localityRouteContext(convertToParamMap({ communitySlug: 'garden' }))
    ).toEqual({
      slug: 'garden',
      baseSegments: ['/c', 'garden'],
    });
  });

  it('prefers the city slug when both route families are present', () => {
    expect(
      localityRouteContext(
        convertToParamMap({ slug: 'austin', communitySlug: 'garden' })
      )
    ).toEqual({
      slug: 'austin',
      baseSegments: ['/city', 'austin'],
    });
  });

  it('returns an empty context when neither locality parameter is present', () => {
    expect(localityRouteContext(convertToParamMap({}))).toEqual({
      slug: '',
      baseSegments: [],
    });
  });
});
