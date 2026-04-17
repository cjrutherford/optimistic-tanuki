import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommunityUiComponent } from './community-ui.component';

describe('CommunityUiComponent', () => {
  let component: CommunityUiComponent;
  let fixture: ComponentFixture<CommunityUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CommunityUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
