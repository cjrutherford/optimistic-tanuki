import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CharacterSheetComponent } from './character-sheet.component';
import { ProfileTelosDto } from '@optimistic-tanuki/ui-models';

describe('CharacterSheetComponent', () => {
  let component: CharacterSheetComponent;
  let fixture: ComponentFixture<CharacterSheetComponent>;

  const profileTelos: ProfileTelosDto = {
    id: 'telos-1',
    profileId: 'profile-1',
    appScope: 'forgeofwill',
    name: 'Aela',
    projects: [],
    description: 'A patient scout',
    goals: ['Help the party prepare'],
    skills: ['Stealth', 'Mapping'],
    interests: ['Cartography'],
    limitations: ['Overthinks danger'],
    strengths: ['Patient'],
    objectives: ['Chart safe routes'],
    coreObjective: 'Protect the party',
    overallProfileSummary: 'Aela is a careful scout who plans ahead.',
    generationStatus: 'ready',
    generatedAt: '2026-06-07T12:00:00.000Z',
    sourceUpdatedAt: '2026-06-07T11:59:00.000Z',
    sourceCount: 3,
    characterSheet: {
      classKey: 'navigator',
      classLabel: 'Navigator',
      archetypeSummary: 'A patient scout and route-finder.',
      level: 4,
      stats: {
        strength: 10,
        dexterity: 16,
        constitution: 12,
        intelligence: 13,
        wisdom: 15,
        charisma: 9,
      },
      traits: ['Patient', 'Prepared'],
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CharacterSheetComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CharacterSheetComponent);
    component = fixture.componentInstance;
  });

  it('renders nothing when disabled', () => {
    component.enabled = false;
    component.profileTelos = profileTelos;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('renders the class label and stat block when enabled with ready data', () => {
    component.enabled = true;
    component.profileTelos = profileTelos;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ranger');
    expect(fixture.nativeElement.textContent).toContain('Dexterity');
    expect(fixture.nativeElement.textContent).toContain('16');
  });

  it('renders the grounded skin when explicitly selected', () => {
    component.enabled = true;
    component.skin = 'grounded';
    component.profileTelos = profileTelos;
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Profile Snapshot');
    expect(fixture.nativeElement.textContent).toContain('Navigator');
    expect(fixture.nativeElement.textContent).toContain('Adaptability');
    expect(fixture.nativeElement.textContent).toContain('Signal Level');
  });

  it('renders a pending state while the character sheet is assembling', () => {
    component.enabled = true;
    component.profileTelos = {
      ...profileTelos,
      generationStatus: 'pending',
    };
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'assembling your character sheet'
    );
  });
});
