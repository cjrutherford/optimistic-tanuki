import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ProfileUiComponent } from './profile-ui.component';

describe('ProfileUiComponent', () => {
  let component: ProfileUiComponent;
  let fixture: ComponentFixture<ProfileUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
