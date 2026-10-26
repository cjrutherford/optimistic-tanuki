import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeadingComponent } from './heading.component';

describe('HeadingComponent', () => {
  let fixture: ComponentFixture<HeadingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeadingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(HeadingComponent);
    fixture.detectChanges();
  });

  it('applies a provided color to the heading text', () => {
    fixture.componentInstance.color = '#123456';
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('.heading');
    expect(heading.style.color).toBe('rgb(18, 52, 86)');
  });
});
