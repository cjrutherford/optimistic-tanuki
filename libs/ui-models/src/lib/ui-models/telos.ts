export interface PersonaTelosDto {
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
  /**
   * What this persona is allowed to do, as coarse capabilities.
   *
   * Absent on records that predate the column, which means no scope was ever
   * decided and every tool is available. An empty list is a decision: look but
   * do not act.
   */
  capabilities?: string[] | null;
}
