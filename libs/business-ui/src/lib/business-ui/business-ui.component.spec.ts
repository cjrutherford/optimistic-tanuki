import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BusinessUiComponent } from './business-ui.component';

describe('BusinessUiComponent', () => {
  let component: BusinessUiComponent;
  let fixture: ComponentFixture<BusinessUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BusinessUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(BusinessUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders its template content', () => {
    const paragraph: HTMLElement = fixture.nativeElement.querySelector('p');

    expect(paragraph.textContent).toContain('BusinessUi works!');
  });
});
