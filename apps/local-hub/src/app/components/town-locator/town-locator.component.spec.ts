import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TownLocatorComponent } from './town-locator.component';

interface GeolocationDouble {
  getCurrentPosition: jest.Mock;
}

const towns = [
  { name: 'Near', slug: 'near', coordinates: { lat: 30.1, lng: -83 } },
  { name: 'Far', slug: 'far', coordinates: { lat: 40, lng: -83 } },
];

describe('TownLocatorComponent', () => {
  let fixture: ComponentFixture<TownLocatorComponent>;
  let geo: GeolocationDouble;
  const text = () => fixture.nativeElement.textContent as string;
  const click = (id: string) =>
    (
      fixture.nativeElement.querySelector(
        `[data-testid="${id}"]`
      ) as HTMLElement
    ).click();

  beforeEach(async () => {
    geo = { getCurrentPosition: jest.fn() };
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: geo,
      configurable: true,
    });
    await TestBed.configureTestingModule({
      imports: [TownLocatorComponent, RouterTestingModule],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    }).compileComponents();
    fixture = TestBed.createComponent(TownLocatorComponent);
    fixture.componentRef.setInput('towns', towns);
    fixture.detectChanges();
  });

  it('never asks for location until the button is pressed', () => {
    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
  });

  it('lists the closest towns after the visitor opts in, without storing anything', () => {
    const setItem = jest.spyOn(Storage.prototype, 'setItem');
    geo.getCurrentPosition.mockImplementation((ok) =>
      ok({ coords: { latitude: 30, longitude: -83 } })
    );
    click('use-my-location');
    fixture.detectChanges();
    expect(text()).toContain('Closest towns to you');
    expect(
      fixture.nativeElement.querySelector('[data-testid="locator-found"] li')
        ?.textContent
    ).toContain('Near');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('falls back to the manual selector when location is denied', () => {
    geo.getCurrentPosition.mockImplementation((_ok, fail) => fail({ code: 1 }));
    click('use-my-location');
    fixture.detectChanges();
    expect(text()).toContain("We couldn't use your location");
    expect(
      fixture.nativeElement.querySelector('[data-testid="town-select"]')
    ).not.toBeNull();
  });

  it('says so when geolocation is unavailable', () => {
    Object.defineProperty(globalThis.navigator, 'geolocation', {
      value: undefined,
      configurable: true,
    });
    click('use-my-location');
    fixture.detectChanges();
    expect(text()).toContain("Location isn't available here");
  });

  it('opens the chosen town directory', () => {
    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture.componentInstance.choose('far');
    expect(navigate).toHaveBeenCalledWith(['/city', 'far', 'businesses']);
  });
});
