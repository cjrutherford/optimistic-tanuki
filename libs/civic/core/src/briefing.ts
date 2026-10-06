import { boldHeadline } from './briefing2.js';
export interface BriefingSection {
  heading: string;
  summary: string;
  items: { title: string; date?: string; url?: string }[];
}

export interface BriefingThread {
  heading: string;
  history: string;
  meetings: string[];
  links: { title: string; url?: string }[];
  story?: string;
}

export interface BriefingInput {
  locality: string;
  cadence: string;
  periodStart: string;
  periodEnd: string;
  tldr: string[];
  threads?: BriefingThread[];
  sections: BriefingSection[];
  sourceCount: number;
  model: string;
}

/** Deterministic template: dates/venues come from stored fields, never the LLM. */
export function assembleMarkdown(input: BriefingInput): string {
  const lines: string[] = [
    `# Civic Briefing — ${input.locality}`,
    '',
    `Period: ${input.periodStart} to ${input.periodEnd} (${input.cadence}) · Sources: ${input.sourceCount} · Model: ${input.model}`,
    '',
    '## TL;DR',
    '',
    ...input.tldr.map((b) => `- ${b}`),
    '',
  ];
  if ((input.threads ?? []).length) {
    lines.push('## Topic threads', '');
    for (const thread of input.threads ?? []) {
      const span =
        thread.meetings.length > 1
          ? ` (${thread.meetings[thread.meetings.length - 1]} ← ${
              thread.meetings[0]
            }, ${thread.meetings.length} meetings)`
          : thread.meetings.length === 1
          ? ` (${thread.meetings[0]})`
          : '';
      lines.push(`### ${thread.heading}${span}`, '', thread.history, '');
      if (thread.story)
        lines.push(`*Full story: [${thread.heading}](${thread.story})*`, '');
      for (const link of thread.links.slice(0, 6)) {
        lines.push(
          `- ${link.title}${link.url ? ` [source](${link.url})` : ''}`
        );
      }
      lines.push('');
    }
  }
  for (const section of input.sections) {
    lines.push(`## ${section.heading}`, '', section.summary, '');
    for (const item of section.items) {
      const when = item.date ? ` (${item.date})` : '';
      const link = item.url ? ` [source](${item.url})` : '';
      lines.push(`- ${boldHeadline(item.title)}${when}${link}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
