import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToolbarComponent } from './toolbar.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { Subject } from 'rxjs';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('ToolbarComponent', () => {
  let component: ToolbarComponent;
  let fixture: ComponentFixture<ToolbarComponent>;
  let themeService: ThemeService;

  beforeEach(async () => {
    const themeServiceStub = {
      themeColors$: new Subject(),
      getTheme: jest.fn(),
      getAccentColor: jest.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ToolbarComponent, HttpClientTestingModule],
      providers: [{ provide: ThemeService, useValue: themeServiceStub }],
    });

    fixture = TestBed.createComponent(ToolbarComponent);
    component = fixture.componentInstance;
    themeService = TestBed.inject(ThemeService);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    component.ngOnDestroy();
    fixture.destroy();
    jest.resetAllMocks();
  })

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit navToggle event when emit() is called', () => {
    const toggleSpy = jest.spyOn(component.navToggle, 'emit');
    component.emit();
    expect(toggleSpy).toHaveBeenCalled();
  });

  it('should update themeStyles when themeColors$ emits a value', () => {
    const mockColors = {
      background: 'red',
      foreground: 'white',
      accent: 'blue',
    };

    (themeService.themeColors$ as Subject<any>).next({
      background: 'red',
      foreground: 'white',
      accent: 'blue',
    });

    expect(component.themeStyles).toEqual({
      backgroundColor: 'red',
      color: 'white',
      border: '1px solid blue',
    });
  });

  it('should unsubscribe from themeSub on destroy', () => {
    component.themeSub = new Subject<void>().subscribe();
    const themeSpy = jest.spyOn(component.themeSub, 'unsubscribe');
    component.ngOnDestroy();
    expect(themeSpy).toHaveBeenCalled();
  });
});