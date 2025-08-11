import { ProjectTelosDto } from "./project";

export class ProfileTelosDto {
    id: string;
    name: string;
    projects: ProjectTelosDto[];
    description: string;
    goals: string[];
    skills: string[];
    interests: string[];
    limitations: string[];
    strengths: string[];
    objectives: string[];
    coreObjective: string;
    overallProfileSummary: string;
}

export class CreateProfileTelosDto {
    name: string;
    description: string;
    goals: string[];
    skills: string[];
    interests: string[];
    limitations: string[];
    strengths: string[];
    objectives: string[];
    coreObjective: string;
}

export declare type UpdateProfileTelosDto = Partial<ProfileTelosDto>;

export declare type QueryProfileTelosDto = Pick<ProfileTelosDto, 'id' | 'name' | 'description' | 'goals' | 'skills' | 'interests' | 'limitations' | 'strengths' | 'objectives' | 'coreObjective'>;