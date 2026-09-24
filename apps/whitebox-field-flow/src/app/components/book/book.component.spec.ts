import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { BookComponent } from './book.component';
import { FieldFlowApiService } from '../../services/field-flow-api.service';
import { BrandConfigService } from '@optimistic-tanuki/whitebox-brand-config';

describe('BookComponent', () => {
  let component: BookComponent;
  let fixture: ComponentFixture<BookComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        FieldFlowApiService,
        BrandConfigService,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BookComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('creates the booking component and renders arrival windows', () => {
    expect(component).toBeTruthy();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('8:00 AM - 10:00 AM');
    expect(element.textContent).toContain('10:00 AM - 12:00 PM');
    expect(element.textContent).toContain('Proceed to deposit');
  });

  it('validates customer form input before advancing', () => {
    component.fullName = '';
    component.submitBooking();
    expect(component.formError).toContain('full name');

    component.fullName = 'John Miller';
    component.mobilePhone = '';
    component.submitBooking();
    expect(component.formError).toContain('mobile phone');
  });

  it('never uses slice or whitebox in client copy', () => {
    const text = fixture.nativeElement.textContent?.toLowerCase() || '';
    expect(text).not.toContain('slice');
    expect(text).not.toContain('whitebox');
  });
});
