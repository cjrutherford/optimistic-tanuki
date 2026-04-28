import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { of } from 'rxjs';
import { NavigationService } from '@optimistic-tanuki/app-registry';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
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
    expect(compiled.querySelector('otui-aurora-ribbon')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });
});
