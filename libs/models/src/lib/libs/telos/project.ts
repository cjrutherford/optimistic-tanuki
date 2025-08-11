import { ProfileTelosDto } from "./profile";

export class ProjectTelosDto {
    id: string;
    profile: ProfileTelosDto;
    name: string;
    description: string;
    goals: string[];
    skills: string[];
    interests: string[];
    limitations: string[];
    strengths: string[];
    objectives: string[];
    coreObjective: string;
    overallProjectSummary: string;
}

export class CreateProjectTelosDto {
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

export declare type UpdateProjectTelosDto = Partial<ProjectTelosDto>;

export declare type QueryProjectTelosDto = Pick<ProjectTelosDto, 'id' | 'name' | 'description' | 'goals' | 'skills' | 'interests' | 'limitations' | 'strengths' | 'objectives' | 'coreObjective'>;
