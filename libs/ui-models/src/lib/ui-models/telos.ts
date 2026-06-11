export type PersonaTelosDto = {
  id: string;
  name: string;
  description: string;
  goals: string[];
  skills: string[];
  interests: string[];
  limitations: string[];
  strengths: string[];
  objectives: string[];
  coreObjective: string;
  exampleResponses: string[];
  promptTemplate: string;
};

export type ProfileTelosStatsDto = {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
};

export type ProfileCharacterSheetDto = {
  classKey: string;
  classLabel: string;
  archetypeSummary: string;
  level: number;
  stats: ProfileTelosStatsDto;
  traits: string[];
};

export type ProfileTelosSourceFactDto = {
  sourceType: string;
  sourceId: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
};

export type ProfileTelosDto = {
  id: string;
  profileId: string;
  appScope?: string | null;
  projects: unknown[];
  name: string;
  description: string;
  goals: string[];
  skills: string[];
  interests: string[];
  limitations: string[];
  strengths: string[];
  objectives: string[];
  coreObjective: string;
  overallProfileSummary: string;
  generationStatus: 'pending' | 'ready' | 'stale' | 'failed';
  generatedAt?: string | Date | null;
  sourceUpdatedAt?: string | Date | null;
  sourceCount: number;
  characterSheet: ProfileCharacterSheetDto;
  sourceFacts?: ProfileTelosSourceFactDto[];
};
