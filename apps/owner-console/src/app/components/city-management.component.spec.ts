import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MessageService } from '@optimistic-tanuki/message-ui';
import { OwnerConfirmService } from '@optimistic-tanuki/owner-page-ui';
import { CityManagementComponent } from './city-management.component';
import { CommunityService } from '../services/community.service';
import {
  createOwnerConfirmStub,
  OwnerConfirmStub,
} from './owner-confirm.testing';

describe('CityManagementComponent', () => {
  let router: Router;
  let communityService: {
    getCities: jest.Mock;
    deleteCity: jest.Mock;
  };
  let messageService: {
    addMessage: jest.Mock;
  };
  let confirmStub: OwnerConfirmStub;
  let fixture: ComponentFixture<CityManagementComponent>;
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

    confirmStub = createOwnerConfirmStub();
    messageService = {
      addMessage: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CityManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CommunityService, useValue: communityService },
        { provide: MessageService, useValue: messageService },
        { provide: OwnerConfirmService, useValue: confirmStub },
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

  const render = () => {
    fixture = TestBed.createComponent(CityManagementComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };
  const html = () => fixture.nativeElement as HTMLElement;
  const springfield = { id: 'city-1', name: 'Springfield' } as never;

  it('surfaces permission-aware delete failures for city governance', async () => {
    communityService.deleteCity.mockReturnValue(
      throwError(() => ({
        error: {
          message: 'Permission denied: community.delete in app scope local-hub',
        },
      }))
    );

    const component = render();
    await component.deleteCity(springfield);

    expect(messageService.addMessage).toHaveBeenCalledWith({
      content: 'Permission denied: community.delete in app scope local-hub',
      type: 'error',
    });
  });

  it('renders a page heading', () => {
    render();

    expect(html().querySelector('h1')?.textContent).toContain('Cities');
  });

  it('renders records with a null description without throwing', () => {
    communityService.getCities.mockReturnValue(
      of([{ id: 'c2', name: 'Bare', description: null }])
    );

    expect(() => render()).not.toThrow();
    expect(html().querySelectorAll('.city-card')).toHaveLength(1);
  });

  it('shows Unavailable with Retry when the load fails, and recovers', () => {
    communityService.getCities.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'down' } }))
    );
    const component = render();

    expect(component.loadError).toBe('down');
    expect(html().textContent).toContain('Unavailable');
    (
      html().querySelector('ot-owner-state button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(communityService.getCities).toHaveBeenCalledTimes(2);
    expect(html().querySelector('.city-card')).toBeTruthy();
  });

  it('treats a non-array reply as an empty list', () => {
    communityService.getCities.mockReturnValue(of({ message: 'x' }));

    render();

    expect(html().textContent).toContain('No cities exist yet.');
  });

  it('requires typing the name to delete, then reloads', async () => {
    const component = render();

    await component.deleteCity(springfield);

    expect(confirmStub.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'typed',
        typedPhrase: 'Springfield',
        destructive: true,
      })
    );
    expect(communityService.deleteCity).toHaveBeenCalledWith('city-1');
    expect(communityService.getCities).toHaveBeenCalledTimes(2);
  });

  it('does not delete when the confirmation is declined', async () => {
    confirmStub.confirm.mockResolvedValue({ confirmed: false });
    const component = render();

    await component.deleteCity(springfield);

    expect(communityService.deleteCity).not.toHaveBeenCalled();
  });
});
