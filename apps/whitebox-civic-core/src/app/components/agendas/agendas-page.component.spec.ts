import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AgendasPageComponent } from './agendas-page.component';
import { CivicApiService } from '../../services/civic-api.service';

describe('AgendasPageComponent', () => {
  let component: AgendasPageComponent;
  let fixture: ComponentFixture<AgendasPageComponent>;
  let apiMock: { getAgendas: jest.Mock };

  beforeEach(async () => {
    apiMock = {
      getAgendas: jest.fn().mockReturnValue(
        of([
          {
            id: 'agenda-1',
            meetingBody: 'city-council',
            meetingDate: '2026-09-01T18:00:00.000Z',
            title: 'September council session',
            items: [
              {
                id: 'item-1',
                agendaId: 'agenda-1',
                itemNumber: '2',
                title: 'Rezoning request for 142 Bull Street',
                summary: 'A rezoning request seeking setback variance relief.',
              },
            ],
          },
        ])
      ),
    };

    await TestBed.configureTestingModule({
      imports: [AgendasPageComponent],
      providers: [
        provideRouter([]),
        { provide: CivicApiService, useValue: apiMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AgendasPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders agendas with line items and summaries', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('September council session');
    expect(text).toContain('Rezoning request for 142 Bull Street');
    expect(text).toContain('setback variance relief');
  });

  it('searches with the entered filters', () => {
    component.searchText = 'rezoning';
    component.meetingBody = 'city-council';
    const event = { preventDefault: jest.fn() } as unknown as Event;
    component.search(event);

    expect(apiMock.getAgendas).toHaveBeenCalledWith({
      meetingBody: 'city-council',
      search: 'rezoning',
    });
  });

  it('shows an unavailable archive instead of fabricated meetings', () => {
    apiMock.getAgendas.mockReturnValue(
      throwError(() => new Error('civic down'))
    );
    component.search({ preventDefault: () => undefined } as unknown as Event);
    fixture.detectChanges();

    expect(component.agendas).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'Meeting records are unavailable'
    );
    expect(fixture.nativeElement.textContent).not.toContain(
      'September council session'
    );
  });
});
