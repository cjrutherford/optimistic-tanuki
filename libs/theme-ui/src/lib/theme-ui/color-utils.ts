export function generateColorShades(color: string): [string, string][] {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  const lightenDarkenColor = (color: string, factor: number) => {
    const rgb = hexToRgb(color);
    if (!rgb) return color;

    const r = Math.max(Math.min(255, rgb.r + Math.round(255 * factor)), 0);
    const g = Math.max(Math.min(255, rgb.g + Math.round(255 * factor)), 0);
    const b = Math.max(Math.min(255, rgb.b + Math.round(255 * factor)), 0);

    return rgbToHex(r, g, b);
  };

  const shades: [string, string][] = [];
  for (let i = 0; i < 10; i++) {
    const factor = (i - 5) / 5 * 0.1;
    shades.push([i.toString(), lightenDarkenColor(color, factor)]);
  }
  return shades;
}

export function generateComplementaryColor(hexColor: string): string {
  // Convert hex to RGB
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hexColor);
  if (!result) {
    return hexColor;
  }
  let r = parseInt(result[1], 16);
  let g = parseInt(result[2], 16);
  let b = parseInt(result[3], 16);

  // Calculate the complementary color
  r = 255 - r;
  g = 255 - g;
  b = 255 - b;

  // Convert RGB to hex
  return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

export function generateSuccessColor(baseColor: string, saturationFactor = 0.3, lightnessFactor = 0.2): string {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h, s, l };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, (h + 1/3));
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, (h - 1/3));
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Shift hue towards green (around 120° in HSL color wheel)
  h = (h + 0.33) % 1; // Adding 0.33 approximates a 120° shift (1/3 of the circle)

  // Increase saturation and lightness
  s = Math.min(1, s + saturationFactor);
  l = Math.min(1, l + lightnessFactor);

  const { r, g, b } = hslToRgb(h, s, l);

  return rgbToHex(r, g, b);
}

export function generateDangerColor(baseColor: string, saturationFactor = 0.3, lightnessFactor = 0.2): string {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h, s, l };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, (h + 1/3));
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, (h - 1/3));
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Shift hue towards red (around 0° in HSL color wheel)
  h = (h + 0) % 1;

  // Increase saturation and lightness
  s = Math.min(1, s + saturationFactor);
  l = Math.min(1, l + lightnessFactor);

  const { r, g, b } = hslToRgb(h, s, l);

  return rgbToHex(r, g, b);
}

export function generateWarningColor(baseColor: string, saturationFactor = 0.3, lightnessFactor = 0.2): string {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };

  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return { h, s, l };
  };

  const hslToRgb = (h: number, s: number, l: number) => {
    let r, g, b;

    if (s === 0) {
      r = g = b = l; // achromatic
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, (h + 1/3));
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, (h - 1/3));
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
  };

  const rgbToHex = (r: number, g: number, b: number) => {
    return "#" + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  };

  const rgb = hexToRgb(baseColor);
  if (!rgb) return baseColor;

  let { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // Shift hue towards yellow (around 60° in HSL color wheel)
  h = (h + 0.166) % 1; // Adding 0.166 approximates a 60° shift (1/6 of the circle)

  // Increase saturation and lightness
  s = Math.min(1, s + saturationFactor);
  l = Math.min(1, l + lightnessFactor);

  const { r, g, b } = hslToRgb(h, s, l);

  return rgbToHex(r, g, b);
}
