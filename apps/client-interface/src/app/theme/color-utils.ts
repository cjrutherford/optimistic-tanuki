export function generateColorShades(color: string): [string, string][] {
  return [
    ['lighten-90', lighten(color, 0.9)],
    ['lighten-70', lighten(color, 0.7)],
    ['lighten-50', lighten(color, 0.5)],
    ['lighten-30', lighten(color, 0.3)],
    ['lighten-10', lighten(color, 0.1)],
    ['standard', color],
    ['darken-10', darken(color, 0.1)],
    ['darken-30', darken(color, 0.3)],
    ['darken-50', darken(color, 0.5)],
    ['darken-70', darken(color, 0.7)],
    ['darken-90', darken(color, 0.9)],
  ];
}

function lighten(color: string, amount: number): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.min(255, Math.floor(r + (255 - r) * amount));
  g = Math.min(255, Math.floor(g + (255 - g) * amount));
  b = Math.min(255, Math.floor(b + (255 - b) * amount));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function darken(color: string, amount: number): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateSuccessColor(color: string): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.max(0, r - 40);
  g = Math.min(255, g + 50);
  b = Math.min(255, b + 10);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateDangerColor(color: string): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.min(255, r + 70);
  g = Math.max(0, g - 50);
  b = Math.max(0, b - 50);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateWarningColor(color: string): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.min(255, r + 80);
  g = Math.min(255, g + 10);
  b = Math.max(0, b - 60);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function generateComplementaryColor(color: string): string {
  let r = parseInt(color.slice(1, 3), 16);
  let g = parseInt(color.slice(3, 5), 16);
  let b = parseInt(color.slice(5, 7), 16);

  r = Math.abs(255 - r);
  g = Math.abs(255 - g);
  b = Math.abs(255 - b);
  
  const hashVal = "#" + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
  return hashVal;
}


