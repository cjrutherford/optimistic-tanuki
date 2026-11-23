import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { OwnerAccessService } from '../../services/owner-access.service';
import { TownContextService } from '../../services/town-context.service';
import { TownDaylightComponent } from './town-daylight.component';

interface AccessDouble {
  load: jest.Mock;
}

describe('TownDaylightComponent', () => {
  async function render(options: {
    townId?: string;
    all?: boolean;
    permissions?: string[];
    selected?: { id: string; name: string } | null;
  }) {
    const access: AccessDouble = {
      load: jest.fn().mockReturnValue(
        of({
          status: 'owner',
          all: options.all ?? true,
          permissions: new Set(options.permissions ?? []),
        })
      ),
    };
    TestBed.configureTestingModule({
      imports: [TownDaylightComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OwnerAccessService, useValue: access },
        {
          provide: TownContextService,
          useValue: { selected: () => options.selected ?? null },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(
                options.townId ? { townId: options.townId } : {}
              ),
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(TownDaylightComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    TestBed.inject(HttpTestingController)
      .match(() => true)
      .forEach((request) => request.flush({ data: [] }));
  });

  it('shows every panel to an owner, without its own page title', async () => {
    const page = await render({
      townId: 't1',
      selected: { id: 't1', name: 'Adel' },
    });
    expect(page.querySelector('ot-owner-page-header')?.textContent).toContain(
      'Daylight: Adel'
    );
    expect(page.querySelector('ot-daylight-operations h1')).toBeNull();
    for (const id of [
      'pipeline-heading',
      'density-heading',
      'notices-heading',
      'callback-heading',
      'maintenance-heading',
    ])
      expect(page.querySelector(`#${id}`)).not.toBeNull();
  });

  it('shows only the panels the owner role grants', async () => {
    const page = await render({ all: false, permissions: ['takedown.manage'] });
    expect(page.querySelector('#notices-heading')).not.toBeNull();
    expect(page.querySelector('#pipeline-heading')).toBeNull();
    expect(page.querySelector('#density-heading')).toBeNull();
  });

  it('shows no panel to an account with no operator permissions', async () => {
    const page = await render({ all: false, permissions: [] });
    expect(page.textContent).toContain('This page is for Daylight operators.');
    expect(page.querySelector('section section')).toBeNull();
  });

  it('is titled plainly on the all-towns page', async () => {
    const page = await render({ selected: { id: 't1', name: 'Adel' } });
    expect(page.querySelector('ot-owner-page-header')?.textContent).toContain(
      'Daylight'
    );
    expect(
      page.querySelector('ot-owner-page-header')?.textContent
    ).not.toContain('Adel');
  });
});
