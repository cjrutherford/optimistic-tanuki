import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { CityManagementComponent } from './city-management.component';
import { CommunityService } from '../services/community.service';

describe('CityManagementComponent', () => {
  let router: Router;
  let communityService: {
    getCities: jest.Mock;
    deleteCity: jest.Mock;
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
      getCities: jest.fn().mockReturnValue(
        of([
          {
            id: 'city-1',
            name: 'Springfield',
            description: 'Community Ops governed city record',
            city: 'Springfield',
            adminArea: 'Oregon',
            countryCode: 'US',
            population: 20000,
            localityType: 'city',
            createdAt: new Date().toISOString(),
          },
        ])
      ),
      deleteCity: jest.fn().mockReturnValue(of(undefined)),
    };

    messageService = {
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CityManagementComponent],
      providers: [
        provideRouter([]),
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

  it('navigates to the city create flow from the governance surface', () => {
    const fixture = TestBed.createComponent(CityManagementComponent);

    fixture.componentInstance.createNew();

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/cities/new']);
  });

  it('surfaces permission-aware delete failures for city governance', () => {
    communityService.deleteCity.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Permission denied: community.delete in app scope local-hub',
        },
      }))
    );
    jest.spyOn(window, 'confirm').mockReturnValue(true);

    const fixture = TestBed.createComponent(CityManagementComponent);
    fixture.detectChanges();

    fixture.componentInstance.deleteCity(
      {
        id: 'city-1',
        name: 'Springfield',
      } as any,
      { stopPropagation: jest.fn() } as any
    );

    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Permission denied: community.delete in app scope local-hub',
      type: 'error',
    });
  });
});
