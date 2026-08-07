import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PersonalCloudSectionComponent } from './personal-cloud-section.component';

describe('PersonalCloudSectionComponent', () => {
  let fixture: ComponentFixture<PersonalCloudSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalCloudSectionComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonalCloudSectionComponent);
    fixture.componentRef.setInput('ownershipNotes', ['Owned directly']);
    fixture.detectChanges();
  });

  it('uses a neutral soft card for ownership notes and preserves motion', () => {
    const element = fixture.nativeElement as HTMLElement;
    const card = element.querySelector('otui-card');

    expect(card).not.toBeNull();
    expect(card?.getAttribute('tone')).toBe('neutral');
    expect(card?.getAttribute('emphasis')).toBe('soft');
    expect(element.querySelector('.ownership-list')?.textContent).toContain(
      'Owned directly'
    );
    expect(element.querySelector('otui-aurora-ribbon')).not.toBeNull();
  });
});
