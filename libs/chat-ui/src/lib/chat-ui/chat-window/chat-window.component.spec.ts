import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChatWindowComponent } from './chat-window.component';

describe('ChatWindowComponent', () => {
  let component: ChatWindowComponent;
  let fixture: ComponentFixture<ChatWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatWindowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChatWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit windowStateChange with new state on onWindowStateChange', () => {
    jest.spyOn(component.windowStateChange, 'emit');
    component.onWindowStateChange('fullscreen');
    expect(component.windowState).toBe('fullscreen');
    expect(component.windowStateChange.emit).toHaveBeenCalledWith('fullscreen');
  });

  it('should emit windowStateChange with hidden state on onClose', () => {
    jest.spyOn(component.windowStateChange, 'emit');
    component.onClose();
    expect(component.windowState).toBe('hidden');
    expect(component.windowStateChange.emit).toHaveBeenCalledWith('hidden');
  });
});
