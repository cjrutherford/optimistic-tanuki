import { ProfileTelosDto } from "@optimistic-tanuki/models";

export function generateProfileTelosMessage(user: ProfileTelosDto): string {
    const telosArray: string[] = [
        `User's name is ${user.name}.`,
        `User's goals are: ${user.goals.join(', ')}`,
        `User's skills are: ${user.skills.join(', ')}`,
        `User's limitations are: ${user.limitations.join(', ')}`,
        `User's core objective is: ${user.coreObjective}.`
    ];

    return telosArray.join('\n');
}