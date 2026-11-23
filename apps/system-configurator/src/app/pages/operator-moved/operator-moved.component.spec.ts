import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OperatorMovedComponent } from './operator-moved.component';

describe('OperatorMovedComponent', () => {
  it('tells the owner where hardware quotes went', async () => {
    await TestBed.configureTestingModule({
      imports: [OperatorMovedComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(OperatorMovedComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Owner Console');
    expect(text).toContain('Hardware quotes');
  });
});
