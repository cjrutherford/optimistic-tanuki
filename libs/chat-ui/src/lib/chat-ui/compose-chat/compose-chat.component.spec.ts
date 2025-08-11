import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComposeChatComponent } from './compose-chat.component';

describe('ComposeChatComponent', () => {
  let component: ComposeChatComponent;
  let fixture: ComponentFixture<ComposeChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposeChatComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComposeChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
