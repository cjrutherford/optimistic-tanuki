import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VideoUiComponent } from './video-ui.component';

describe('VideoUiComponent', () => {
  let component: VideoUiComponent;
  let fixture: ComponentFixture<VideoUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VideoUiComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(VideoUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
