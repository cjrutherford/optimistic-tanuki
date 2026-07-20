import { Inject, Injectable, Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProfileTelos } from '../entities';
import { Any, FindOptionsWhere, Like, Repository } from 'typeorm';
import {
  CreateProfileTelosDto,
  ProfileCharacterSheetDto,
  ProfileTelosDto,
  ProfileTelosSourceFactDto,
  QueryProfileTelosDto,
  UpdateProfileTelosDto,
  UpsertProfileTelosSourceDto,
} from '@optimistic-tanuki/models';

type GenerationStatus = ProfileTelosDto['generationStatus'];

@Injectable()
export class ProfileTelosService {
  private readonly logger = new Logger(ProfileTelosService.name);
  private readonly queuedProfiles = new Set<string>();
  private readonly activeProfiles = new Set<string>();
  private readonly rerunProfiles = new Set<string>();
  private readonly ignoredTerms = new Set([
    'about',
    'across',
    'activity',
    'active',
    'authorship',
    'blogging',
    'build',
    'builders',
    'catalog',
    'categories',
    'category',
    'channel',
    'channels',
    'classified',
    'classifieds',
    'communities',
    'community',
    'content',
    'counts',
    'current',
    'events',
    'facts',
    'featured',
    'guild',
    'includes',
    'interest',
    'interests',
    'lead',
    'listings',
    'marketplace',
    'owned',
    'posts',
    'profile',
    'publishing',
    'recent',
    'recurring',
    'ready',
    'skills',
    'social',
    'source',
    'stories',
    'summary',
    'teams',
    'titles',
    'topic',
    'topics',
    'video',
    'videos',
    'visible',
  ]);
  private readonly metadataWeights: Record<string, number> = {
    interests: 4,
    skills: 4,
    topics: 4,
    categories: 3,
    conditions: 2,
    communities: 2.5,
    ownedCommunities: 2.5,
    recentTitles: 1.5,
    publishedTitles: 1.5,
    draftTitles: 1,
    recentVideoTitles: 1.5,
    recentChannels: 1.5,
    eventNames: 2,
    locations: 1,
    traits: 2,
  };
  private readonly namespaceWeights: Record<string, number> = {
    profile: 4,
    social: 3,
    blogging: 3,
    videos: 3,
    classifieds: 2,
  };

  constructor(
    @Inject(getRepositoryToken(ProfileTelos))
    private readonly profileRepository: Repository<ProfileTelos>
  ) {}

  async create(data: CreateProfileTelosDto) {
    const profile = this.profileRepository.create({
      sourceFacts: data.sourceFacts || [],
      ...data,
    });
    return await this.profileRepository.save(profile);
  }

  async findAll(query: QueryProfileTelosDto): Promise<ProfileTelosDto[]> {
    const where: FindOptionsWhere<ProfileTelos> = {};

    if (query.name) {
      where.name = query.name;
    }

    if (query.description) {
      where.description = query.description;
    }

    if (query.profileId) {
      where.profileId = query.profileId;
    }

    if (query.appScope) {
      where.appScope = query.appScope;
    }

    if (query.goals) {
      where.goals = Any(query.goals);
    }

    if (query.skills) {
      where.skills = Any(query.skills);
    }

    if (query.interests) {
      where.interests = Any(query.interests);
    }

    if (query.limitations) {
      where.limitations = Any(query.limitations);
    }

    if (query.strengths) {
      where.strengths = Any(query.strengths);
    }

    if (query.objectives) {
      where.objectives = Any(query.objectives);
    }

    if (query.coreObjective) {
      where.coreObjective = Like(`%${query.coreObjective}%`);
    }

    return await this.profileRepository.find({ where });
  }

  async findOne(id: string): Promise<ProfileTelosDto | null> {
    return await this.profileRepository.findOne({ where: { id } });
  }

  async findByProfileId(profileId: string): Promise<ProfileTelosDto | null> {
    return await this.profileRepository.findOne({ where: { profileId } });
  }

  async upsertSource(
    data: UpsertProfileTelosSourceDto
  ): Promise<ProfileTelosDto> {
    const existing = await this.profileRepository.findOne({
      where: { profileId: data.profileId },
    });
    const now = new Date();
    const nextStatus: GenerationStatus = existing ? 'stale' : 'pending';
    const mergedFacts = existing
      ? this.mergeSourceFacts(existing.sourceFacts || [], data.facts)
      : data.facts;

    const profile = existing
      ? Object.assign(existing, {
          name: data.profileName,
          appScope: data.appScope ?? existing.appScope ?? null,
          sourceFacts: mergedFacts,
          sourceCount: mergedFacts.length,
          sourceUpdatedAt: now,
          generationStatus: nextStatus,
        })
      : this.profileRepository.create({
          profileId: data.profileId,
          appScope: data.appScope ?? null,
          name: data.profileName,
          description:
            data.bio || `${data.profileName} is building their story.`,
          goals: [],
          skills: data.skills || [],
          interests: data.interests || [],
          limitations: [],
          strengths: [],
          objectives: [],
          coreObjective: '',
          overallProfileSummary: '',
          generationStatus: nextStatus,
          generatedAt: null,
          sourceUpdatedAt: now,
          sourceCount: mergedFacts.length,
          sourceFacts: mergedFacts,
          characterSheet: this.createEmptyCharacterSheet(),
        });

    const saved = await this.profileRepository.save(profile);
    this.scheduleRegeneration(saved.profileId);
    return saved;
  }

  async regenerate(profileId: string): Promise<ProfileTelos | null> {
    const existing = await this.profileRepository.findOne({
      where: { profileId },
    });
    if (!existing) {
      return null;
    }

    try {
      const synthesis = this.synthesizeProfileTelos(existing);
      const updated = Object.assign(existing, synthesis, {
        generationStatus: 'ready' as const,
        generatedAt: new Date(),
      });
      return await this.profileRepository.save(updated);
    } catch (error) {
      this.logger.error(
        `Failed regenerating TELOS for profile ${profileId}`,
        error instanceof Error ? error.stack : undefined
      );
      existing.generationStatus = 'failed';
      await this.profileRepository.save(existing);
      return existing;
    }
  }

  async update(
    id: string,
    data: UpdateProfileTelosDto
  ): Promise<ProfileTelos | null> {
    await this.profileRepository.update(id, data);
    return await this.profileRepository.findOne({ where: { id } });
  }

  async resetDerived(profileId: string): Promise<ProfileTelos | null> {
    const existing = await this.profileRepository.findOne({
      where: { profileId },
    });
    if (!existing) {
      return null;
    }

    const reset = Object.assign(existing, {
      description: `${existing.name} is building their story.`,
      goals: [],
      skills: [],
      interests: [],
      limitations: [],
      strengths: [],
      objectives: [],
      coreObjective: '',
      overallProfileSummary: '',
      generationStatus: 'pending' as const,
      generatedAt: null,
      sourceUpdatedAt: existing.sourceUpdatedAt ?? new Date(),
      sourceCount: existing.sourceFacts?.length ?? 0,
      characterSheet: this.createEmptyCharacterSheet(),
    });

    return await this.profileRepository.save(reset);
  }

  async remove(id: string): Promise<void> {
    await this.profileRepository.delete(id);
  }

  private scheduleRegeneration(profileId: string): void {
    if (this.activeProfiles.has(profileId)) {
      this.rerunProfiles.add(profileId);
      return;
    }

    if (this.queuedProfiles.has(profileId)) {
      return;
    }

    this.queuedProfiles.add(profileId);
    setTimeout(async () => {
      this.queuedProfiles.delete(profileId);
      this.activeProfiles.add(profileId);
      try {
        await this.regenerate(profileId);
      } catch (error) {
        this.logger.warn(
          `Background TELOS regeneration failed for profile ${profileId}: ${
            error instanceof Error ? error.message : error
          }`
        );
      } finally {
        this.activeProfiles.delete(profileId);
        if (this.rerunProfiles.delete(profileId)) {
          this.scheduleRegeneration(profileId);
        }
      }
    }, 0);
  }

  private mergeSourceFacts(
    existingFacts: ProfileTelosSourceFactDto[],
    incomingFacts: ProfileTelosSourceFactDto[]
  ): ProfileTelosSourceFactDto[] {
    const namespaces = new Set(
      incomingFacts.map((fact) => this.getSourceNamespace(fact.sourceType))
    );
    const preservedFacts = existingFacts.filter(
      (fact) => !namespaces.has(this.getSourceNamespace(fact.sourceType))
    );
    return [...preservedFacts, ...incomingFacts];
  }

  private getSourceNamespace(sourceType: string): string {
    return sourceType.split(':')[0] || sourceType;
  }

  private synthesizeProfileTelos(profile: ProfileTelos) {
    const factText = profile.sourceFacts.map((fact) => fact.content).join(' ');
    const factWords = this.tokenize(factText);
    const synthesisSignals = this.buildSynthesisSignals(profile.sourceFacts);
    const interests = this.uniqueWords([
      ...profile.interests,
      ...this.collectTaggedWords(profile.sourceFacts, [
        'interest',
        'interests',
      ]),
      ...this.selectTopTerms(synthesisSignals.interestScores, 6),
    ]);
    const skills = this.uniqueWords([
      ...profile.skills,
      ...this.collectTaggedWords(profile.sourceFacts, ['skill', 'skills']),
      ...this.selectTopTerms(synthesisSignals.skillScores, 6),
    ]);

    const classKey = this.resolveClassKey(
      factWords,
      skills,
      interests,
      synthesisSignals.termScores
    );
    const characterSheet = this.buildCharacterSheet(
      classKey,
      profile.name,
      factWords,
      synthesisSignals.activityScore,
      synthesisSignals.namespaceCount
    );
    const strengths = this.uniqueWords([
      ...profile.strengths,
      ...this.pickTraits(
        this.uniqueWords([
          ...factWords,
          ...this.selectTopTerms(synthesisSignals.termScores, 12),
        ]),
        [
          'patient',
          'curious',
          'focused',
          'kind',
          'steady',
          'leadership',
          'strategy',
        ]
      ),
    ]);
    const limitations = this.uniqueWords([
      ...profile.limitations,
      ...this.pickTraits(factWords, [
        'stubborn',
        'cautious',
        'restless',
        'overthinks',
      ]),
    ]);
    const goals = this.uniqueWords([
      ...profile.goals,
      ...this.buildGoalCandidates(profile.sourceFacts),
    ]);
    const objectives = goals.slice(0, 3);
    const summary = this.buildSummary(
      profile.name,
      classKey,
      interests,
      skills
    );

    return {
      name: profile.name,
      description: summary,
      goals,
      skills,
      interests,
      limitations,
      strengths,
      objectives,
      coreObjective: goals[0] || `Support ${profile.name}'s long-term goals`,
      overallProfileSummary: summary,
      characterSheet,
    };
  }

  private resolveClassKey(
    words: string[],
    skills: string[],
    interests: string[],
    termScores: Map<string, number>
  ): string {
    const joined = [
      ...words,
      ...skills.map(this.normalize),
      ...interests.map(this.normalize),
    ];
    const classScores = {
      navigator: this.scoreTerms(termScores, [
        'stealth',
        'scout',
        'tracking',
        'mapping',
        'bows',
        'exploration',
      ]),
      organizer: this.scoreTerms(termScores, [
        'strategy',
        'planning',
        'leadership',
        'coordination',
        'command',
        'mentoring',
      ]),
      analyst: this.scoreTerms(termScores, [
        'coding',
        'research',
        'writing',
        'teaching',
        'design',
        'systems',
      ]),
      supporter: this.scoreTerms(termScores, [
        'healing',
        'care',
        'support',
        'helping',
        'kind',
        'guidance',
      ]),
    };

    const rankedClass = Object.entries(classScores).sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })[0];

    if (rankedClass && rankedClass[1] >= 3) {
      return rankedClass[0];
    }

    if (
      joined.some((word) =>
        ['stealth', 'scout', 'tracking', 'mapping'].includes(word)
      )
    ) {
      return 'navigator';
    }
    if (
      joined.some((word) =>
        ['strategy', 'planning', 'leadership'].includes(word)
      )
    ) {
      return 'organizer';
    }
    if (
      joined.some((word) =>
        ['coding', 'research', 'writing', 'teaching'].includes(word)
      )
    ) {
      return 'analyst';
    }
    if (joined.some((word) => ['healing', 'care', 'support'].includes(word))) {
      return 'supporter';
    }
    return 'generalist';
  }

  private buildCharacterSheet(
    classKey: string,
    profileName: string,
    words: string[],
    activityScore: number,
    namespaceCount: number
  ): ProfileCharacterSheetDto {
    const baseStats = {
      strength: 10,
      dexterity: 10,
      constitution: 10,
      intelligence: 10,
      wisdom: 10,
      charisma: 10,
    };

    switch (classKey) {
      case 'navigator':
        baseStats.dexterity += 5;
        baseStats.wisdom += 4;
        baseStats.intelligence += 2;
        break;
      case 'organizer':
        baseStats.strength += 3;
        baseStats.charisma += 4;
        baseStats.wisdom += 2;
        break;
      case 'analyst':
        baseStats.intelligence += 5;
        baseStats.wisdom += 3;
        baseStats.dexterity += 1;
        break;
      case 'supporter':
        baseStats.wisdom += 5;
        baseStats.constitution += 2;
        baseStats.charisma += 2;
        break;
      default:
        baseStats.constitution += 2;
        baseStats.charisma += 1;
        break;
    }

    const traits = this.uniqueWords(
      this.pickTraits(words, [
        'patient',
        'curious',
        'focused',
        'kind',
        'steady',
        'bold',
      ]).map(this.toTitle)
    );

    return {
      classKey,
      classLabel: this.resolveClassLabel(classKey),
      archetypeSummary: this.buildArchetypeSummary(profileName, classKey),
      level: Math.min(
        20,
        Math.max(
          1,
          1 +
            Math.floor(words.length / 18) +
            Math.floor(activityScore / 25) +
            Math.max(0, namespaceCount - 1)
        )
      ),
      stats: baseStats,
      traits,
    };
  }

  private buildSummary(
    profileName: string,
    classKey: string,
    interests: string[],
    skills: string[]
  ): string {
    const interestText =
      interests.slice(0, 3).join(', ') || 'their current pursuits';
    const skillText = skills.slice(0, 3).join(', ') || 'steady learning';
    return `${profileName} presents as a ${this.resolveClassLabel(
      classKey
    ).toLowerCase()} profile focused on ${interestText}, with visible strengths in ${skillText}.`;
  }

  private buildGoalCandidates(facts: ProfileTelosSourceFactDto[]): string[] {
    return this.uniqueWords(
      facts
        .map((fact) => fact.title || fact.content)
        .flatMap((value) => value.split(/[.!?]/))
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 12)
        .slice(0, 3)
    );
  }

  private collectTaggedWords(
    facts: ProfileTelosSourceFactDto[],
    keys: string[]
  ): string[] {
    return facts.flatMap((fact) => {
      const metadata = fact.metadata || {};
      return keys.flatMap((key) => {
        const value = metadata[key];
        if (Array.isArray(value)) {
          return value.filter(
            (item): item is string => typeof item === 'string'
          );
        }
        if (typeof value === 'string') {
          return [value];
        }
        return [];
      });
    });
  }

  private pickTraits(words: string[], candidates: string[]): string[] {
    return candidates.filter((candidate) => words.includes(candidate));
  }

  private buildSynthesisSignals(facts: ProfileTelosSourceFactDto[]): {
    termScores: Map<string, number>;
    interestScores: Map<string, number>;
    skillScores: Map<string, number>;
    activityScore: number;
    namespaceCount: number;
  } {
    const termScores = new Map<string, number>();
    const interestScores = new Map<string, number>();
    const skillScores = new Map<string, number>();
    const namespaces = new Set<string>();
    let activityScore = 0;

    for (const fact of facts) {
      const namespace = this.getSourceNamespace(fact.sourceType);
      namespaces.add(namespace);
      const namespaceWeight = this.namespaceWeights[namespace] ?? 1;

      this.addTokenScores(termScores, fact.title, 1.5 * namespaceWeight);
      this.addTokenScores(termScores, fact.content, 1 * namespaceWeight);
      this.addTokenScores(interestScores, fact.title, 0.75 * namespaceWeight);
      this.addTokenScores(interestScores, fact.content, 0.5 * namespaceWeight);
      this.addTokenScores(skillScores, fact.title, 0.5 * namespaceWeight);
      this.addTokenScores(skillScores, fact.content, 0.5 * namespaceWeight);

      const metadata = fact.metadata || {};
      for (const [key, weight] of Object.entries(this.metadataWeights)) {
        const values = this.extractMetadataValues(metadata[key]);
        for (const value of values) {
          this.addTokenScores(termScores, value, weight * namespaceWeight);
          if (['skills'].includes(key)) {
            this.addTokenScores(skillScores, value, weight * namespaceWeight);
          } else {
            this.addTokenScores(
              interestScores,
              value,
              weight * namespaceWeight
            );
            if (['topics', 'traits'].includes(key)) {
              this.addTokenScores(
                skillScores,
                value,
                (weight - 1) * namespaceWeight
              );
            }
          }
        }
      }

      const counts = metadata['counts'];
      if (counts && typeof counts === 'object') {
        for (const value of Object.values(counts as Record<string, unknown>)) {
          if (typeof value === 'number' && Number.isFinite(value)) {
            activityScore += value;
          }
        }
      }
    }

    return {
      termScores,
      interestScores,
      skillScores,
      activityScore,
      namespaceCount: namespaces.size,
    };
  }

  private extractMetadataValues(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.flatMap((entry) => this.extractMetadataValues(entry));
    }
    if (typeof value === 'string') {
      return [value];
    }
    return [];
  }

  private addTokenScores(
    scores: Map<string, number>,
    value: string | undefined,
    weight: number
  ): void {
    if (!value) {
      return;
    }

    for (const token of this.tokenize(value)) {
      if (this.ignoredTerms.has(token)) {
        continue;
      }
      scores.set(token, (scores.get(token) ?? 0) + weight);
    }
  }

  private selectTopTerms(scores: Map<string, number>, limit: number): string[] {
    return [...scores.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, limit)
      .map(([term]) => term);
  }

  private scoreTerms(scores: Map<string, number>, terms: string[]): number {
    return terms.reduce(
      (sum, term) => sum + (scores.get(this.normalize(term)) ?? 0),
      0
    );
  }

  private tokenize(value: string | undefined): string[] {
    if (!value) {
      return [];
    }

    return value
      .split(/[^a-zA-Z]+/)
      .map((word) => this.normalize(word))
      .filter((word) => word.length > 2);
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  private uniqueWords(values: string[]): string[] {
    const seen = new Set<string>();
    return values.filter((value) => {
      const normalized = this.normalize(value);
      if (!normalized || seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  private toTitle(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private resolveClassLabel(classKey: string): string {
    switch (classKey) {
      case 'navigator':
        return 'Navigator';
      case 'organizer':
        return 'Organizer';
      case 'analyst':
        return 'Analyst';
      case 'supporter':
        return 'Supporter';
      default:
        return 'Generalist';
    }
  }

  private buildArchetypeSummary(profileName: string, classKey: string): string {
    switch (classKey) {
      case 'navigator':
        return `${profileName} shows a pattern of exploration, preparation, and directional thinking.`;
      case 'organizer':
        return `${profileName} shows a pattern of coordination, leadership, and forward planning.`;
      case 'analyst':
        return `${profileName} shows a pattern of research, systems thinking, and structured problem solving.`;
      case 'supporter':
        return `${profileName} shows a pattern of care, guidance, and dependable support for others.`;
      default:
        return `${profileName} shows a balanced pattern across several areas rather than one dominant mode.`;
    }
  }

  private createEmptyCharacterSheet(): ProfileCharacterSheetDto {
    return {
      classKey: 'generalist',
      classLabel: 'Generalist',
      archetypeSummary:
        'Your profile snapshot is being assembled from persisted profile signals.',
      level: 1,
      stats: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10,
      },
      traits: [],
    };
  }
}
