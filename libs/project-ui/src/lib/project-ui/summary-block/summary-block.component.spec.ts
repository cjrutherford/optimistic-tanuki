import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SummaryBlockComponent } from './summary-block.component';
import { By } from '@angular/platform-browser';
import { TileComponent } from '@optimistic-tanuki/common-ui';

describe('SummaryBlockComponent', () => {
  let component: SummaryBlockComponent;
  let fixture: ComponentFixture<SummaryBlockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SummaryBlockComponent, TileComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SummaryBlockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the correct title', () => {
    const testTitle = 'Test Title';
    component.title = testTitle;
    fixture.detectChanges();
    const compiled = fixture.debugElement.query(By.css('h6')).nativeElement;
    expect(compiled.textContent).toContain(testTitle);
  });

  it('should display the correct count', () => {
    const testCount = 123;
    component.count = testCount;
    fixture.detectChanges();
    const compiled = fixture.debugElement.query(By.css('h2')).nativeElement;
    expect(compiled.textContent).toContain(testCount.toString());
  });

  it('should emit onClick event when clicked', () => {
    jest.spyOn(component.onClick, 'emit');
    const clickHandleElement = fixture.debugElement.query(By.css('.click-handle'));
    clickHandleElement.triggerEventHandler('click', null);
    expect(component.onClick.emit).toHaveBeenCalled();
  });
});