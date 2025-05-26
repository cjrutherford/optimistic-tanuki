import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SocialUiComponent } from './social-ui.component';

describe('SocialUiComponent', () => {
  let component: SocialUiComponent;
  let fixture: ComponentFixture<SocialUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SocialUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SocialUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
