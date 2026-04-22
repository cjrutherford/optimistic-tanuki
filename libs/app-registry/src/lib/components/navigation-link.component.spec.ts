import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NavigationLinkComponent } from './navigation-link.component';
import { NavigationService } from '../navigation.service';

describe('NavigationLinkComponent', () => {
  let fixture: ComponentFixture<NavigationLinkComponent>;
  const navigation = {
    generateUrl: jest.fn().mockReturnValue('https://haicomputer.com/build/new'),
    navigate: jest.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationLinkComponent],
      providers: [{ provide: NavigationService, useValue: navigation }],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationLinkComponent);
    fixture.componentInstance.targetAppId = 'system-configurator';
    fixture.componentInstance.path = '/build/new';
    fixture.componentInstance.label = 'Build a System';
    fixture.detectChanges();
  });

  it('renders a generated navigation URL', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    expect(link.href).toBe('https://haicomputer.com/build/new');
    expect(link.textContent).toContain('Build a System');
  });

  it('delegates same-tab clicks to the navigation service', () => {
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;

    link.click();

    expect(navigation.navigate).toHaveBeenCalledWith(
      'system-configurator',
      '/build/new',
      { includeReturn: true }
    );
  });
});
