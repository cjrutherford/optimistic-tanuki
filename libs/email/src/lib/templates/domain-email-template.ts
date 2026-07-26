export type EmailTemplateTone = 'default' | 'security' | 'success';

export interface DomainEmailAction {
  label: string;
  url: string;
}

export interface DomainEmailTemplateOptions {
  domain: string;
  appName?: string;
  heading: string;
  body: string[];
  action?: DomainEmailAction;
  note?: string;
  tone?: EmailTemplateTone;
}

export interface RenderedDomainEmail {
  rootDomain: string;
  html: string;
  text: string;
}

interface DomainTheme {
  name: string;
  accent: string;
  surface: string;
}

const DOMAIN_THEMES: Record<string, DomainTheme> = {
  'optimistic-tanuki.com': {
    name: 'Optimistic Tanuki',
    accent: '#c2410c',
    surface: '#fff7ed',
  },
  'hopefulaspirationsindustries.com': {
    name: 'Hopeful Aspirations Industries',
    accent: '#0f766e',
    surface: '#f0fdfa',
  },
  'christopherrutherford.net': {
    name: 'Christopher Rutherford',
    accent: '#1d4ed8',
    surface: '#eff6ff',
  },
};

export function rootDomainFor(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const host = (() => {
    if (trimmed.includes('@') && !trimmed.includes('://')) {
      return trimmed.slice(trimmed.lastIndexOf('@') + 1);
    }
    try {
      return new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
        .hostname;
    } catch {
      return trimmed;
    }
  })()
    .replace(/^www\./, '')
    .replace(/\.$/, '');

  const labels = host.split('.').filter(Boolean);
  return labels.length >= 2 ? labels.slice(-2).join('.') : host;
}

export function renderDomainEmailTemplate(
  options: DomainEmailTemplateOptions
): RenderedDomainEmail {
  const rootDomain = rootDomainFor(options.domain);
  const theme = DOMAIN_THEMES[rootDomain] ?? {
    name: rootDomain,
    accent: '#334155',
    surface: '#f8fafc',
  };
  const name = options.appName?.trim() || theme.name;
  const accent = options.tone === 'security' ? '#b91c1c' : theme.accent;
  const body = options.body.map((paragraph) => escapeHtml(paragraph));
  const note = options.note ? escapeHtml(options.note) : '';
  const action = options.action;
  const text = [
    name,
    '',
    options.heading,
    '',
    ...options.body,
    ...(action ? ['', `${action.label}: ${action.url}`] : []),
    ...(options.note ? ['', options.note] : []),
    '',
    `Sent by ${name} · ${rootDomain}`,
  ].join('\n');

  const bodyMarkup = body
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:16px;line-height:24px;color:#334155;">${paragraph}</p>`
    )
    .join('');
  const actionMarkup = action
    ? `<tr><td style="padding:8px 32px 28px;"><a href="${escapeAttribute(
        action.url
      )}" style="display:inline-block;background-color:${accent};border-radius:6px;color:#ffffff;font-family:Arial,sans-serif;font-size:16px;font-weight:700;line-height:20px;padding:14px 20px;text-decoration:none;">${escapeHtml(
        action.label
      )}</a><p style="margin:16px 0 0;font-family:Arial,sans-serif;font-size:13px;line-height:19px;color:#64748b;word-break:break-all;">Or copy this link: <a href="${escapeAttribute(
        action.url
      )}" style="color:${accent};">${escapeHtml(action.url)}</a></p></td></tr>`
    : '';
  const noteMarkup = note
    ? `<tr><td style="padding:0 32px 28px;"><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#64748b;">${note}</p></td></tr>`
    : '';

  return {
    rootDomain,
    text,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background-color:${
      theme.surface
    };"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${
      theme.surface
    };"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:10px;overflow:hidden;"><tr><td style="height:6px;background-color:${accent};font-size:0;line-height:0;">&nbsp;</td></tr><tr><td style="padding:28px 32px 20px;"><p style="margin:0;font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.08em;line-height:20px;text-transform:uppercase;color:${accent};">${escapeHtml(
      name
    )}</p><h1 style="margin:16px 0 0;font-family:Georgia,serif;font-size:30px;font-weight:700;line-height:38px;color:#0f172a;">${escapeHtml(
      options.heading
    )}</h1></td></tr><tr><td style="padding:0 32px;">${bodyMarkup}</td></tr>${actionMarkup}${noteMarkup}<tr><td style="padding:20px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;font-family:Arial,sans-serif;font-size:12px;line-height:18px;color:#64748b;">Sent by ${escapeHtml(
      name
    )} · ${escapeHtml(
      rootDomain
    )}</p></td></tr></table></td></tr></table></body></html>`,
  };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#096;');
}
