import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { EnvironmentProviders, Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { of } from 'rxjs';
import { CommunityService } from '../../services/community.service';

interface CommunityServiceDouble {
  getCityBySlug: jest.Mock;
}

export const ADEL = { name: 'Adel', slug: 'adel-ga', localitySlug: 'adel-ga' };

/** Test providers for a Daylight page: the route, the town lookup, and HTTP. */
export function daylightProviders(options: {
  params?: Record<string, string>;
  query?: Record<string, string>;
  city?: unknown;
  extra?: (Provider | EnvironmentProviders)[];
}): (Provider | EnvironmentProviders)[] {
  const communities: CommunityServiceDouble = {
    getCityBySlug: jest.fn().mockResolvedValue(options.city),
  };
  return [
    provideHttpClient(),
    provideHttpClientTesting(),
    provideRouter([]),
    { provide: CommunityService, useValue: communities },
    {
      provide: ActivatedRoute,
      useValue: {
        paramMap: of(convertToParamMap(options.params ?? {})),
        queryParamMap: of(convertToParamMap(options.query ?? {})),
      },
    },
    ...(options.extra ?? []),
  ];
}

export function http(): HttpTestingController {
  return TestBed.inject(HttpTestingController);
}
