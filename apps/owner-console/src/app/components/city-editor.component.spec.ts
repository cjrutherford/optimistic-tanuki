import { TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  provideRouter,
  Router,
} from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CityEditorComponent } from './city-editor.component';
import { CommunityService } from '../services/community.service';

describe('CityEditorComponent', () => {
  let router: Router;
  let communityService: {
    getCity: jest.Mock;
    createCity: jest.Mock;
    updateCity: jest.Mock;
  };
  let messageService: {
    addMessage: jest.Mock;
  };
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(async () => {
    consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    communityService = {
      getCity: jest.fn().mockReturnValue(
        of({
          id: 'city-1',
          name: 'Springfield',
          slug: 'springfield',
          description: 'Community Ops governed city record',
          countryCode: 'US',
          adminArea: 'Oregon',
          city: 'Springfield',
          localityType: 'city',
        })
      ),
      createCity: jest.fn().mockReturnValue(of({ id: 'city-2' })),
      updateCity: jest.fn().mockReturnValue(of({ id: 'city-1' })),
    };

    messageService = {
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CityEditorComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({}),
            },
          },
        },
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    jest.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('creates a city through the shared community governance API', () => {
    const fixture = TestBed.createComponent(CityEditorComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.cityForm.patchValue({
      name: 'Portland',
      slug: 'portland',
      description: 'Regional city record',
      countryCode: 'US',
      adminArea: 'Oregon',
      city: 'Portland',
    });

    component.save();

    expect(communityService.createCity).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Portland',
        localityType: 'city',
      })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/cities']);
  });

  it('surfaces permission-aware update failures without navigating away', async () => {
    communityService.updateCity.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Permission denied: community.update in app scope local-hub',
        },
      }))
    );

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [CityEditorComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: 'city-1' }),
            },
          },
        },
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
      ],
    }).compileComponents();

    const scopedRouter = TestBed.inject(Router);
    jest.spyOn(scopedRouter, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(CityEditorComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.cityForm.patchValue({
      name: 'Springfield',
      description: 'Updated',
      countryCode: 'US',
      adminArea: 'Oregon',
      city: 'Springfield',
    });

    component.save();

    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Permission denied: community.update in app scope local-hub',
      type: 'error',
    });
    expect(scopedRouter.navigate).not.toHaveBeenCalledWith([
      '/dashboard/cities',
    ]);
  });
});
