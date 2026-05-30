import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StateMessageComponent } from './state-message.component';
import {
  EmptyStateComponent,
  ErrorStateComponent,
  LoadingStateComponent,
} from './index';

describe('StateMessageComponent', () => {
  let component: StateMessageComponent;
  let fixture: ComponentFixture<StateMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StateMessageComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(StateMessageComponent);
    component = fixture.componentInstance;
  });

  it('renders headline and body', () => {
    component.headline = 'Try again';
    component.body = 'The server hiccuped.';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Try again');
    expect(fixture.nativeElement.textContent).toContain('The server hiccuped.');
  });

  it('uses role=alert and aria-live=assertive for error kind', () => {
    component.kind = 'error';
    fixture.detectChanges();
    const root: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');
    expect(root.getAttribute('role')).toBe('alert');
    expect(root.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses role=status by default', () => {
    fixture.detectChanges();
    const root: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
  });

  it('hides icon area when hideIcon is true', () => {
    component.hideIcon = true;
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.state-message__icon')
    ).toBeNull();
  });
});

describe('Empty/Loading/Error wrappers', () => {
  it('EmptyState defaults to empty kind and neutral tone', () => {
    const fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.detectChanges();
    const root: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');
    expect(root.getAttribute('data-kind')).toBe('empty');
    expect(root.getAttribute('data-tone')).toBe('neutral');
  });

  it('LoadingState defaults to loading kind and info tone', () => {
    const fixture = TestBed.createComponent(LoadingStateComponent);
    fixture.detectChanges();
    const root: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');
    expect(root.getAttribute('data-kind')).toBe('loading');
    expect(root.getAttribute('data-tone')).toBe('info');
  });

  it('ErrorState defaults to error kind and danger tone', () => {
    const fixture = TestBed.createComponent(ErrorStateComponent);
    fixture.detectChanges();
    const root: HTMLElement =
      fixture.nativeElement.querySelector('.state-message');
    expect(root.getAttribute('data-kind')).toBe('error');
    expect(root.getAttribute('data-tone')).toBe('danger');
  });
});
