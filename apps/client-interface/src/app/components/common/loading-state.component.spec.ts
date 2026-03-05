import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingStateComponent } from './loading-state.component';

describe('LoadingStateComponent', () => {
  let component: LoadingStateComponent;
  let fixture: ComponentFixture<LoadingStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoadingStateComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LoadingStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render spinner with default diameter', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const spinner = compiled.querySelector('.spinner');
    expect(spinner).toBeTruthy();
  });

  it('should render with custom diameter', () => {
    component.diameter = () => 60;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    const spinner = compiled.querySelector('.spinner');
    expect(spinner?.style.width).toBe('60px');
    expect(spinner?.style.height).toBe('60px');
  });

  it('should render message when provided', () => {
    component.message = () => 'Loading data...';
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-message')?.textContent).toContain(
      'Loading data...'
    );
  });

  it('should not render message when not provided', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-message')).toBeFalsy();
  });

  it('should have overlay class when overlay is true', () => {
    component.overlay = () => true;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled
        .querySelector('.loading-container')
        ?.classList.contains('overlay')
    ).toBe(true);
  });

  it('should not have overlay class when overlay is false', () => {
    component.overlay = () => false;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(
      compiled
        .querySelector('.loading-container')
        ?.classList.contains('overlay')
    ).toBe(false);
  });
});
