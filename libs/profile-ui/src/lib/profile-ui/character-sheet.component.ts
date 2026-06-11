import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { ProfileTelosDto } from '@optimistic-tanuki/ui-models';

export type CharacterSheetSkin = 'fantasy' | 'grounded';

@Component({
  selector: 'lib-character-sheet',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-sheet.component.html',
  styleUrl: './character-sheet.component.scss',
})
export class CharacterSheetComponent {
  @Input() enabled = false;
  @Input() profileTelos: ProfileTelosDto | null = null;
  @Input() skin: CharacterSheetSkin = 'fantasy';

  readonly classSkin: Record<string, string> = {
    navigator: 'Ranger',
    organizer: 'Warlord',
    analyst: 'Scholar',
    supporter: 'Cleric',
    generalist: 'Adventurer',
  };

  get title(): string {
    return this.skin === 'grounded' ? 'Profile Snapshot' : 'Character Sheet';
  }

  get eyebrow(): string {
    return this.title;
  }

  get levelLabel(): string {
    return this.skin === 'grounded' ? 'Signal Level' : 'Level';
  }

  get pendingCopy(): string {
    return this.skin === 'grounded'
      ? 'We are assembling your profile snapshot from the story your activity is already telling.'
      : 'We are assembling your character sheet from the story your activity is already telling.';
  }

  get failedCopy(): string {
    return this.skin === 'grounded'
      ? 'We could not finish your latest profile snapshot refresh yet.'
      : 'We could not finish your latest character sheet refresh yet.';
  }

  get statLabels() {
    if (this.skin === 'grounded') {
      return [
        { key: 'strength', label: 'Drive' },
        { key: 'dexterity', label: 'Adaptability' },
        { key: 'constitution', label: 'Consistency' },
        { key: 'intelligence', label: 'Insight' },
        { key: 'wisdom', label: 'Judgment' },
        { key: 'charisma', label: 'Presence' },
      ] as const;
    }

    return [
      { key: 'strength', label: 'Strength' },
      { key: 'dexterity', label: 'Dexterity' },
      { key: 'constitution', label: 'Constitution' },
      { key: 'intelligence', label: 'Intelligence' },
      { key: 'wisdom', label: 'Wisdom' },
      { key: 'charisma', label: 'Charisma' },
    ] as const;
  }

  get displayClassLabel(): string {
    const classLabel = this.profileTelos?.characterSheet.classLabel || '';
    const classKey = this.profileTelos?.characterSheet.classKey;
    if (this.skin === 'grounded') {
      return classLabel;
    }

    if (!classKey) {
      return classLabel;
    }

    return this.classSkin[classKey] || classLabel;
  }

  get displayArchetypeSummary(): string {
    if (this.skin === 'grounded') {
      return this.profileTelos?.characterSheet.archetypeSummary || '';
    }

    const classKey = this.profileTelos?.characterSheet.classKey;
    switch (classKey) {
      case 'navigator':
        return 'A pathfinder archetype with strong instincts for exploration, preparation, and timing.';
      case 'organizer':
        return 'A leadership archetype shaped by coordination, direction-setting, and strategic momentum.';
      case 'analyst':
        return 'A knowledge archetype shaped by research, systems thinking, and structured problem solving.';
      case 'supporter':
        return 'A support archetype shaped by care, steadiness, and practical guidance for others.';
      case 'generalist':
        return 'A balanced archetype with adaptable strengths across several domains.';
      default:
        return this.profileTelos?.characterSheet.archetypeSummary || '';
    }
  }
}
