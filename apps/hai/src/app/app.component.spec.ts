import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { NavigationService } from '@optimistic-tanuki/app-registry';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { AppComponent } from './app.component';
import { ANALYTICS_TRANSPORT } from './services/analytics.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ANALYTICS_TRANSPORT, useValue: () => undefined },
        {
          provide: HaiAppDirectoryService,
          useValue: { getResolvedApps: jest.fn().mockReturnValue(of([])) },
        },
        {
          provide: NavigationService,
          useValue: {
            generateUrl: jest.fn().mockReturnValue('https://haicomputer.com'),
            navigate: jest.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the HAI about tag', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('hai-about-tag')).not.toBeNull();
  });

  it('renders the aurora ribbon motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-personality-scene')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('offsets anchor scrolling by the sticky header height', () => {
    const setOffset = jest.spyOn(TestBed.inject(ViewportScroller), 'setOffset');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector(
      'hai-title-bar'
    ) as HTMLElement;
    document.body.appendChild(fixture.nativeElement);
    jest
      .spyOn(header, 'getBoundingClientRect')
      .mockReturnValue({ height: 80 } as DOMRect);

    const offset = setOffset.mock.calls[0][0] as () => [number, number];

    expect(offset()).toEqual([0, 96]);
    fixture.nativeElement.remove();
  });

  it('ends every page with the contact strip', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('main hai-contact-strip')
    ).not.toBeNull();
  });

  it('offers a skip link that moves focus to the page content', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    document.body.appendChild(fixture.nativeElement);
    const element = fixture.nativeElement as HTMLElement;
    const link = element.querySelector('a.skip-link') as HTMLAnchorElement;

    expect(element.firstElementChild?.nextElementSibling ?? link).toBeTruthy();
    expect(link.textContent?.trim()).toBe('Skip to content');
    link.click();

    expect(document.activeElement?.id).toBe('main-content');
    fixture.nativeElement.remove();
  });
});
