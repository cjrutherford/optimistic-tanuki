import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ApproachComponent } from './approach.component';
import { PRINCIPLES } from './approach.data';

describe('ApproachComponent', () => {
  let fixture: ComponentFixture<ApproachComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ApproachComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(ApproachComponent);
    fixture.detectChanges();
  });

  it('renders the heading and every principle', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('How I approach engineering');
    const items = el.querySelectorAll('.principle');
    expect(items).toHaveLength(PRINCIPLES.length);
    expect(PRINCIPLES.length).toBeGreaterThanOrEqual(3);
    expect(PRINCIPLES.length).toBeLessThanOrEqual(4);
  });
});
