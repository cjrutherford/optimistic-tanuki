import { Injectable } from '@angular/core';
import {
  AnchorPoint,
  ResolvedLocalityLabel,
  buildCoordinateFallbackLabel,
  buildResolvedLocalityLabel,
} from '@optimistic-tanuki/ui-models';

@Injectable({
  providedIn: 'root',
})
export class LocalityResolutionService {
  resolveFromCommunity(input: {
    name?: string | null;
    city?: string | null;
    adminArea?: string | null;
    countryCode?: string | null;
    timezone?: string | null;
    coordinates?: AnchorPoint | null;
  }): ResolvedLocalityLabel {
    if (input.city || input.adminArea || input.countryCode) {
      return buildResolvedLocalityLabel({
        primary: input.city || input.name,
        city: input.city || input.name,
        adminArea: input.adminArea,
        countryCode: input.countryCode,
        timezone: input.timezone,
      });
    }

    return this.resolveFromAnchor(
      input.coordinates ?? {
        lat: 0,
        lng: 0,
      }
    );
  }

  resolveFromAnchor(anchor: AnchorPoint): ResolvedLocalityLabel {
    return buildCoordinateFallbackLabel(anchor);
  }
}
