import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GlassContainerComponent } from './glass-container.component';

describe('GlassContainerComponent', () => {
  let component: GlassContainerComponent;
  let fixture: ComponentFixture<GlassContainerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GlassContainerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(GlassContainerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
