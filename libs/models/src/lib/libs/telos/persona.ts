
export class PersonaTelosDto {
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
}

export class CreatePersonaTelosDto {
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
}

export declare type UpdatePersonaTelosDto = Partial<PersonaTelosDto>;

export declare type QueryPersonaTelsosDto = Pick<PersonaTelosDto, 'id' | 'name' | 'description' | 'goals' | 'skills' | 'interests' | 'limitations' | 'strengths' | 'objectives' | 'coreObjective' >;
