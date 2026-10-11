import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssessmentPageComponent } from './assessment-page.component';
import { ASSESSMENT_NEXT_STEPS } from '../../content/assessment';

describe('AssessmentPageComponent', () => {
  it('has one h1, explains what happens next, and hosts the form', () => {
    TestBed.configureTestingModule({
      imports: [AssessmentPageComponent, HttpClientTestingModule],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(AssessmentPageComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('h1')).toHaveLength(1);
    expect(element.querySelector('h1')?.textContent).toBe(
      'Private cloud assessment'
    );
    expect(element.querySelectorAll('.next-steps li')).toHaveLength(
      ASSESSMENT_NEXT_STEPS.length
    );
    expect(element.querySelector('hai-assessment-form form')).not.toBeNull();
  });
});
