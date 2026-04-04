import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
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
