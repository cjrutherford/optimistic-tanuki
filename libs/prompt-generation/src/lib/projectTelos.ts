import { ProjectTelosDto } from "@optimistic-tanuki/models";

export function generateProjectTelosMessage(project: ProjectTelosDto): string {
    const telosArray: string[] = [
        `Project's name is ${project.name}.`,
        `Project's goals are: ${project.goals.join(', ')}`,
        `Project's skills are: ${project.skills.join(', ')}`,
        `Project's limitations are: ${project.limitations.join(', ')}`,
        `Project's core objective is: ${project.coreObjective}.`
    ];

    return telosArray.join('\n');
}