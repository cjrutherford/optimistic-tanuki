import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MadLibComposition } from '@optimistic-tanuki/models';
import { MadLibComposerComponent } from './mad-lib-composer.component';

describe('MadLibComposerComponent', () => {
  let fixture: ComponentFixture<MadLibComposerComponent>;
  let component: MadLibComposerComponent;
  let emitted: MadLibComposition[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MadLibComposerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MadLibComposerComponent);
    component = fixture.componentInstance;
    emitted = [];
    component.compositionChange.subscribe((c) => emitted.push(c));
    fixture.detectChanges();
  });

  const latest = () => emitted[emitted.length - 1];

  it('maps each slot to its onboarding field', () => {
    component.setText('serviceOffer', 'React modernization');
    component.setText('idealCustomer', 'VP Engineering');

    expect(latest().values.serviceOffer).toBe('React modernization');
    expect(latest().values.idealCustomer).toBe('VP Engineering');
  });

  it('collects list slots as multiple entries', () => {
    component.drafts['industries'] = 'SaaS';
    component.commitItem('industries');
    component.drafts['industries'] = 'Healthcare';
    component.commitItem('industries');

    expect(latest().values.industries).toEqual(['SaaS', 'Healthcare']);
  });

  it('does not add duplicate or blank list entries', () => {
    component.drafts['industries'] = 'SaaS';
    component.commitItem('industries');
    component.drafts['industries'] = 'SaaS';
    component.commitItem('industries');
    component.drafts['industries'] = '   ';
    component.commitItem('industries');

    expect(latest().values.industries).toEqual(['SaaS']);
  });

  it('removes a list entry', () => {
    component.drafts['skills'] = 'React';
    component.commitItem('skills');
    component.drafts['skills'] = 'Vue';
    component.commitItem('skills');
    component.removeItem('skills', 'React');

    expect(latest().values.skills).toEqual(['Vue']);
  });

  it('seeds empty slots from what the resume found', () => {
    component.initialValues = {
      professionalTitle: 'Senior Platform Engineer',
      industries: ['SaaS'],
    };

    expect(latest().values.professionalTitle).toBe('Senior Platform Engineer');
    expect(latest().values.industries).toEqual(['SaaS']);
  });

  it('never overwrites something the user has already entered', () => {
    component.setText('professionalTitle', 'Staff Engineer');

    component.initialValues = { professionalTitle: 'Senior Platform Engineer' };

    // The prefill arrives after the user has typed, so it must lose.
    expect(latest().values.professionalTitle).toBe('Staff Engineer');
  });

  it('composes a readable sentence from the filled slots', () => {
    component.setText('professionalTitle', 'Senior Platform Engineer');
    component.setText('idealCustomer', 'VP Engineering');
    component.setText('serviceOffer', 'React modernization');
    component.drafts['industries'] = 'SaaS';
    component.commitItem('industries');
    component.drafts['outcomes'] = 'faster releases';
    component.commitItem('outcomes');

    const sentence = latest().sentence;
    expect(sentence).toContain(
      'I am a Senior Platform Engineer who helps VP Engineering in SaaS'
    );
    expect(sentence).toContain('React modernization');
    expect(sentence).toContain('faster releases');
  });

  it('joins three or more list values with commas and a final and', () => {
    for (const skill of ['React', 'TypeScript', 'Node']) {
      component.drafts['skills'] = skill;
      component.commitItem('skills');
    }

    expect(latest().sentence).toContain('React, TypeScript, and Node');
  });

  it('reports required slots that are still blank', () => {
    component.setText('serviceOffer', 'React modernization');

    const { unfilledFields } = latest();
    expect(unfilledFields).toContain('idealCustomer');
    expect(unfilledFields).toContain('industries');
    // Optional slots are not reported as missing.
    expect(unfilledFields).not.toContain('communicationStyle');
  });

  it('omits blank slots from values so nothing is sent as empty', () => {
    component.setText('serviceOffer', 'React modernization');

    expect(latest().values).not.toHaveProperty('idealCustomer');
    expect(Object.keys(latest().values)).toEqual(['serviceOffer']);
  });

  it('clears everything on reset', () => {
    component.setText('serviceOffer', 'React modernization');
    component.reset();

    expect(latest().values).toEqual({});
  });
});
