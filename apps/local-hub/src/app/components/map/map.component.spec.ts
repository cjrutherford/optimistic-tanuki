import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { MapComponent } from './map.component';

describe('MapComponent', () => {
  let fixture: ComponentFixture<MapComponent>;
  let component: MapComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MapComponent],
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    }).compileComponents();

    fixture = TestBed.createComponent(MapComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the map container rendered while loading', () => {
    component.isLoading.set(true);
    fixture.detectChanges();

    const container: HTMLElement | null =
      fixture.nativeElement.querySelector('.map-container');

    expect(container).not.toBeNull();
    expect(container?.classList.contains('hidden')).toBe(false);
  });
});
