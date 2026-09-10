import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';
import { NavigationConfirmationHostComponent } from './navigation-confirmation-host.component';

describe('NavigationConfirmationHostComponent', () => {
  let fixture: ComponentFixture<NavigationConfirmationHostComponent>;
  let service: NavigationConfirmationService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NavigationConfirmationHostComponent],
      providers: [provideRouter([]), NavigationConfirmationService],
    }).compileComponents();

    fixture = TestBed.createComponent(NavigationConfirmationHostComponent);
    service = TestBed.inject(NavigationConfirmationService);
    fixture.detectChanges();
  });

  it('renders the shared modal with accessible navigation copy while a decision is pending', () => {
    service.requestConfirmation('/owner/desk');
    fixture.detectChanges();

    const modal = fixture.nativeElement.querySelector('otui-modal');
    const dialog = fixture.nativeElement.querySelector('.modal-dialog');

    expect(modal).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-labelledby')).toBe(
      'navigation-confirmation-title'
    );
    expect(dialog?.getAttribute('aria-describedby')).toBe(
      'navigation-confirmation-description'
    );
    expect(fixture.nativeElement.textContent).toContain(
      'You have unsaved changes.'
    );
  });

  it('renders after the normal change-detection pass following a synchronous request', () => {
    service.requestConfirmation('/owner/desk');
    fixture.detectChanges();
    (
      fixture.nativeElement.querySelector(
        '[data-action="stay-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    expect(service.isPending()).toBe(false);

    service.requestConfirmation('/owner/desk');
    fixture.detectChanges();
    const navigateByUrl = jest
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    (
      fixture.nativeElement.querySelector(
        '[data-action="leave-unsaved-navigation"]'
      ) as HTMLButtonElement
    ).click();
    expect(service.isPending()).toBe(false);
    expect(navigateByUrl).toHaveBeenCalledWith('/owner/desk');
  });

  it('treats the shared modal close event as Stay', () => {
    service.requestConfirmation('/owner/desk');
    fixture.detectChanges();

    const modal = fixture.debugElement.query(By.directive(ModalComponent))
      .componentInstance as ModalComponent;
    modal.close.emit();

    expect(service.isPending()).toBe(false);
  });
});
