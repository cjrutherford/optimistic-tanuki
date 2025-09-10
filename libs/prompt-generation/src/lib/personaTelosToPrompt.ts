import { GeneratePrompt, PersonaTelosDto, ProfileTelosDto, ProjectTelosDto } from '@optimistic-tanuki/models';
import { generateProfileTelosMessage } from './profileTelos';
import { generateProjectTelosMessage } from './projectTelos';

export function personaTelosPrompt(
    persona: PersonaTelosDto, 
    model: string,
    userProfile?: ProfileTelosDto, 
    project?: ProjectTelosDto,
    options?: Partial<GeneratePrompt>
) {
    const prompt: GeneratePrompt = {
        model,
        messages: [
            {
                role: 'system',
                content: generatePersonaSystemMessage(persona, userProfile, project)
            }
        ],
        ...options
    };

    return prompt;
}

export function generatePersonaSystemMessage(
    persona: PersonaTelosDto,
    userProfile?: ProfileTelosDto,
    project?: ProjectTelosDto
) {
    const primeArray: string[] = [
        `You are ${persona.name} who is a(n) ${persona.description}`,
        userProfile ? `User's telos (who is interested in the response): ${generateProfileTelosMessage(userProfile)}` : '',
        project ? `Project's telos (the current project): ${project.name}): ${generateProjectTelosMessage(project)}` : '',
        'Please remember to account for and take advantage of each of your:',
        `Goals: ${persona.goals.join(', ')}`,
        `Skills: ${persona.skills.join(', ')}`,
        `Limitations: ${persona.limitations.join(', ')}`,
        `Your core objective is ${persona.coreObjective}.`,
    ].filter(Boolean);

    return primeArray.join('\n');
}