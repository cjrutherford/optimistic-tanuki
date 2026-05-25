import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlaygroundComponent } from './playground.component';

describe('PlaygroundComponent', () => {
  let fixture: ComponentFixture<PlaygroundComponent>;
  let component: PlaygroundComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaygroundComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PlaygroundComponent);
    component = fixture.componentInstance;
    component.initialCode = '<button>Example</button>';
    component.activeTab = 'code';
    fixture.detectChanges();
  });

  it('labels the editable code surface for assistive technologies', () => {
    const textarea = fixture.nativeElement.querySelector(
      'textarea.code-input'
    ) as HTMLTextAreaElement;

    expect(textarea.getAttribute('aria-label')).toContain('Editable code');
  });
});
