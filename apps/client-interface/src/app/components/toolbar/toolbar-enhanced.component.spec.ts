import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  tick,
} from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import {
  ToolbarEnhancedComponent,
  ProfileInfo,
} from './toolbar-enhanced.component';
import { DropdownComponent } from '@optimistic-tanuki/common-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';

describe('ToolbarEnhancedComponent', () => {
  let component: ToolbarEnhancedComponent;
  let fixture: ComponentFixture<ToolbarEnhancedComponent>;

  const mockProfile: ProfileInfo = {
    id: '123',
    profileName: 'Test User',
    profilePic: 'https://example.com/avatar.jpg',
  };

  const mockThemeService = {
    themeColors$: of({
      background: '#ffffff',
      foreground: '#000000',
      accent: '#000000',
      complementary: '#666666',
      tertiary: '#333333',
      success: '#00aa00',
      danger: '#cc0000',
      warning: '#ffaa00',
      complementaryGradients: {
        light: 'linear-gradient(#666666, #000000)',
        dark: 'linear-gradient(#000000, #666666)',
      },
    }),
    getTheme: jest.fn().mockReturnValue('light'),
    getCurrentTheme: () => ({
      primary: '#000000',
      background: '#ffffff',
      foreground: '#000000',
    }),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RouterTestingModule,
        DropdownComponent,
        ToolbarEnhancedComponent,
      ],
      providers: [{ provide: ThemeService, useValue: mockThemeService }],
    }).compileComponents();

    fixture = TestBed.createComponent(ToolbarEnhancedComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display profile info when provided', () => {
    component.currentProfile = () => mockProfile;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.avatar')?.getAttribute('src')).toContain(
      'avatar.jpg'
    );
  });

  it('should show unread messages badge when count > 0', () => {
    component.unreadMessages = () => 5;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.unread-badge')).toBeTruthy();
    expect(compiled.querySelector('.unread-badge')?.textContent).toContain('5');
  });

  it('should show 9+ for unread messages > 9', () => {
    component.unreadMessages = () => 15;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.unread-badge')?.textContent).toContain(
      '9+'
    );
  });

  it('should not show badge when unread count is 0', () => {
    component.unreadMessages = () => 0;
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.unread-badge')).toBeFalsy();
  });

  it('should emit logout event when logout is called', () => {
    let emitted = false;
    component.logoutEvent.subscribe(() => (emitted = true));

    component.logout();

    expect(emitted).toBe(true);
  });

  it('should have brand link to feed', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const brandLink = compiled.querySelector('.toolbar-brand');
    expect(brandLink?.getAttribute('routerlink')).toBe('/feed');
  });
});
