import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  let component: TitleBarComponent;
  let fixture: ComponentFixture<TitleBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the available tanuki brand mark', () => {
    const logo = (fixture.nativeElement as HTMLElement).querySelector(
      'otui-app-bar'
    );

    expect(logo?.getAttribute('logosrc')).toBe('assets/images/tanuki.png');
  });

  it('provides navigation to the Systems Lab section', () => {
    const navigateTo = jest.spyOn(component, 'navigateTo');
    const systemsLabLink = component.navItems.find(
      ({ label }) => label === 'Systems Lab'
    );

    expect(systemsLabLink).toBeDefined();
    systemsLabLink?.action?.();

    expect(navigateTo).toHaveBeenCalledWith('#systems-lab');
  });
});
