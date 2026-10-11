import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const enabled = process.env['RR09_I05_LIVE_STACK'] === 'true';
const origin = process.env['BASE_URL'] ?? 'http://127.0.0.1:8080';
const workspaceRoot = process.cwd().endsWith('apps/client-interface-e2e')
  ? resolve(process.cwd(), '../..')
  : process.cwd();
const evidenceDir = join(
  workspaceRoot,
  '.runtime-artifacts',
  'rr09',
  'i05',
  'acceptance'
);
const evidencePath = join(evidenceDir, 'acceptance.jsonl');
const fixtureJournalPath = join(
  workspaceRoot,
  '.runtime-artifacts',
  'rr09',
  'i05',
  'fixture.jsonl'
);
const credentialsPath =
  process.env['RR09_I03_CREDENTIALS_FILE'] ??
  '/home/cjrutherford/.cache/optimistic-tanuki/rr09-i03-credentials.json';

function record(value: Record<string, unknown>): void {
  mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  appendFileSync(
    evidencePath,
    `${JSON.stringify({ observedAt: new Date().toISOString(), ...value })}\n`,
    { mode: 0o600 }
  );
  chmodSync(evidencePath, 0o600);
}

function decodePng(buffer: Buffer): {
  width: number;
  height: number;
  pixels: Uint8Array;
} {
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    throw new Error('Rendered contrast screenshot was not a PNG');
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const compressed: Buffer[] = [];
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset);
    const kind = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (kind === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (kind === 'IDAT') {
      compressed.push(data);
    } else if (kind === 'IEND') {
      break;
    }
    offset += length + 12;
  }
  if (bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0) {
    throw new Error(
      `Unsupported rendered PNG encoding: depth=${bitDepth}, type=${colorType}, interlace=${interlace}`
    );
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const source = inflateSync(Buffer.concat(compressed));
  const decoded = new Uint8Array(height * stride);
  const paeth = (left: number, above: number, upperLeft: number): number => {
    const estimate = left + above - upperLeft;
    const leftDistance = Math.abs(estimate - left);
    const aboveDistance = Math.abs(estimate - above);
    const upperLeftDistance = Math.abs(estimate - upperLeft);
    if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance)
      return left;
    if (aboveDistance <= upperLeftDistance) return above;
    return upperLeft;
  };
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (stride + 1);
    const filter = source[sourceOffset];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = source[sourceOffset + 1 + x];
      const left = x >= channels ? decoded[rowOffset + x - channels] : 0;
      const above = y > 0 ? decoded[rowOffset - stride + x] : 0;
      const upperLeft =
        y > 0 && x >= channels ? decoded[rowOffset - stride + x - channels] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
          ? left
          : filter === 2
          ? above
          : filter === 3
          ? Math.floor((left + above) / 2)
          : filter === 4
          ? paeth(left, above, upperLeft)
          : NaN;
      if (!Number.isFinite(predictor))
        throw new Error(`Unknown PNG filter ${filter}`);
      decoded[rowOffset + x] = (raw + predictor) & 0xff;
    }
  }
  const pixels = new Uint8Array(width * height * 3);
  for (
    let index = 0, pixel = 0;
    index < decoded.length;
    index += channels, pixel += 3
  ) {
    const alpha = channels === 4 ? decoded[index + 3] / 255 : 1;
    pixels[pixel] = Math.round(decoded[index] * alpha + 255 * (1 - alpha));
    pixels[pixel + 1] = Math.round(
      decoded[index + 1] * alpha + 255 * (1 - alpha)
    );
    pixels[pixel + 2] = Math.round(
      decoded[index + 2] * alpha + 255 * (1 - alpha)
    );
  }
  return { width, height, pixels };
}

async function measureRenderedPixelContrast(
  page: import('@playwright/test').Page,
  selector: string,
  index: number,
  label: string
): Promise<Record<string, unknown>> {
  const locator = page.locator(selector).nth(index);
  await locator.scrollIntoViewIfNeeded();
  const preparation = await locator.evaluate(async (target) => {
    const bounds = () => {
      const rect = target.getBoundingClientRect();
      return [rect.x, rect.y, rect.width, rect.height].join(':');
    };
    let priorBounds = bounds();
    let stableFrames = 0;
    for (let frame = 0; frame < 60 && stableFrames < 3; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      const currentBounds = bounds();
      stableFrames = currentBounds === priorBounds ? stableFrames + 1 : 0;
      priorBounds = currentBounds;
    }
    if (stableFrames < 3) {
      throw new Error(
        `Target bounds did not settle for ${label} (${selector}); last bounds ${priorBounds}`
      );
    }
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas color parser unavailable');
    const computed = getComputedStyle(target);
    const color = computed.color;
    const outlineStyle = computed.outlineStyle;
    const outlineWidthValue = computed.outlineWidth;
    const outlineOffsetValue = computed.outlineOffset;
    const outlineColor = computed.outlineColor;
    const boxShadow = computed.boxShadow;
    const targetRect = target.getBoundingClientRect();
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
    let opacity = 1;
    let ancestor: Element | null = target;
    while (ancestor) {
      opacity *= Number.parseFloat(getComputedStyle(ancestor).opacity);
      ancestor = ancestor.parentElement;
    }
    const textRects: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];
    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    let textNode = walker.nextNode();
    while (textNode) {
      if (
        textNode.textContent?.trim() &&
        !textNode.parentElement?.closest('.edited-badge')
      ) {
        const range = document.createRange();
        range.selectNodeContents(textNode);
        for (const rect of Array.from(range.getClientRects())) {
          const left = Math.max(0, rect.left);
          const top = Math.max(0, rect.top);
          const right = Math.min(window.innerWidth, rect.right);
          const bottom = Math.min(window.innerHeight, rect.bottom);
          if (right > left && bottom > top) {
            textRects.push({
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            });
          }
        }
      }
      textNode = walker.nextNode();
    }
    if (textRects.length === 0) {
      const renderedText =
        target instanceof HTMLSelectElement
          ? target.selectedOptions[0]?.textContent?.trim() ||
            target.value.trim()
          : target.textContent?.trim() || '';
      if (!renderedText) {
        throw new Error(
          'Rendered-pixel fallback requires visible text or a selected native control value'
        );
      }
      if (!(target instanceof HTMLSelectElement)) {
        throw new Error(
          'Text target has no visible rendered text in the viewport'
        );
      }
      const rect = target.getBoundingClientRect();
      const left = Math.max(0, rect.left);
      const top = Math.max(0, rect.top);
      const right = Math.min(window.innerWidth, rect.right);
      const bottom = Math.min(window.innerHeight, rect.bottom);
      const insetX = Math.min(4, (right - left) / 10);
      const insetY = Math.min(3, (bottom - top) / 10);
      textRects.push({
        x: left + insetX,
        y: top + insetY,
        width: Math.max(1, right - left - insetX * 2),
        height: Math.max(1, bottom - top - insetY * 2),
      });
    }
    const token = `i05-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const attr = 'data-rr09-i05-pixel-mask';
    target.setAttribute(attr, `${token}-root`);
    for (const child of Array.from(target.querySelectorAll('*'))) {
      child.setAttribute(attr, `${token}-child`);
    }
    const style = document.createElement('style');
    style.setAttribute('data-rr09-i05-pixel-style', token);
    style.textContent = `
      [${attr}="${token}-root"], [${attr}="${token}-child"] {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
        transition: none !important;
        animation: none !important;
      }
      [${attr}="${token}-child"] {
        background-color: transparent !important;
        background-image: none !important;
        border-color: transparent !important;
      }
      [${attr}="${token}-root"] {
        outline: none !important;
        box-shadow: none !important;
      }
      [${attr}="${token}-root"] *, [${attr}="${token}-root"]::before,
      [${attr}="${token}-root"]::after {
        transition: none !important;
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
    const outlineVisible =
      outlineStyle !== 'none' && Number.parseFloat(outlineWidthValue) > 0;
    const indicatorColor = outlineVisible
      ? outlineColor
      : boxShadow.match(/rgba?\([^)]*\)/)?.[0] ?? null;
    const rect = targetRect;
    const outlineWidth = Number.parseFloat(outlineWidthValue) || 0;
    const outlineOffset = Number.parseFloat(outlineOffsetValue) || 0;
    const ringDistance = Math.max(
      1,
      Math.ceil(outlineWidth + outlineOffset + 1)
    );
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const clipX = Math.max(0, Math.floor(rect.x - ringDistance - 2));
    const clipY = Math.max(0, Math.floor(rect.y - ringDistance - 2));
    const clipRight = Math.min(
      viewportWidth,
      Math.ceil(rect.right + ringDistance + 2)
    );
    const clipBottom = Math.min(
      viewportHeight,
      Math.ceil(rect.bottom + ringDistance + 2)
    );
    const ringPoints: Array<{ x: number; y: number }> = [];
    const top = rect.y - ringDistance;
    const bottom = rect.bottom + ringDistance;
    const left = rect.x - ringDistance;
    const right = rect.right + ringDistance;
    for (let x = left; x <= right; x += 2) {
      ringPoints.push({ x, y: top }, { x, y: bottom });
    }
    for (let y = top; y <= bottom; y += 2) {
      ringPoints.push({ x: left, y }, { x: right, y });
    }
    ringPoints.push(
      { x: left, y: top },
      { x: right, y: top },
      { x: left, y: bottom },
      { x: right, y: bottom }
    );
    const clippedRingPoints = ringPoints.map((point) => ({
      x: Math.min(viewportWidth - 1, Math.max(0, point.x)),
      y: Math.min(viewportHeight - 1, Math.max(0, point.y)),
    }));
    let indicator: [number, number, number, number] | null = null;
    if (indicatorColor) {
      context.fillStyle = indicatorColor;
      context.fillRect(0, 0, 1, 1);
      const [ir, ig, ib, ia] = context.getImageData(0, 0, 1, 1).data;
      indicator = [ir, ig, ib, ia / 255];
    }
    return {
      r,
      g,
      b,
      alpha: alpha / 255,
      opacity,
      textRects,
      token,
      outlineVisible: outlineVisible || boxShadow !== 'none',
      indicatorColor,
      indicator,
      focusClip: {
        x: clipX,
        y: clipY,
        width: clipRight - clipX,
        height: clipBottom - clipY,
      },
      ringPoints: clippedRingPoints,
      ringDistance,
      textRectsAvailable: textRects.length,
    };
  });
  const pixelRects: Array<ReturnType<typeof decodePng>> = [];
  let focusImage: ReturnType<typeof decodePng> | null = null;
  try {
    for (const rect of preparation.textRects) {
      const screenshot = await page.screenshot({
        clip: rect,
        animations: 'disabled',
      });
      pixelRects.push(decodePng(screenshot));
    }
    if (preparation.outlineVisible && preparation.indicator) {
      const screenshot = await page.screenshot({
        clip: preparation.focusClip,
        animations: 'disabled',
      });
      focusImage = decodePng(screenshot);
    }
  } finally {
    await page.evaluate((token) => {
      const attr = 'data-rr09-i05-pixel-mask';
      for (const element of Array.from(
        document.querySelectorAll(`[${attr}]`)
      )) {
        if (element.getAttribute(attr)?.startsWith(token))
          element.removeAttribute(attr);
      }
      document
        .querySelector(`[data-rr09-i05-pixel-style="${token}"]`)
        ?.remove();
    }, preparation.token);
  }
  const effectiveForeground = [
    preparation.r * preparation.alpha * preparation.opacity +
      255 * (1 - preparation.alpha * preparation.opacity),
    preparation.g * preparation.alpha * preparation.opacity +
      255 * (1 - preparation.alpha * preparation.opacity),
    preparation.b * preparation.alpha * preparation.opacity +
      255 * (1 - preparation.alpha * preparation.opacity),
  ];
  const luminance = (r: number, g: number, b: number): number => {
    const channels = [r, g, b].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const foregroundLuminance = luminance(...effectiveForeground);
  let minimumIndicatorRatio = Number.POSITIVE_INFINITY;
  let minimumRatio = Number.POSITIVE_INFINITY;
  let worstBackground: number[] | null = null;
  let sampledPixels = 0;
  for (const image of pixelRects) {
    for (let offset = 0; offset < image.pixels.length; offset += 3) {
      const background = [
        image.pixels[offset],
        image.pixels[offset + 1],
        image.pixels[offset + 2],
      ];
      const backgroundLuminance = luminance(...background);
      const [lighter, darker] = [foregroundLuminance, backgroundLuminance].sort(
        (left, right) => right - left
      );
      const ratio = (lighter + 0.05) / (darker + 0.05);
      if (ratio < minimumRatio) {
        minimumRatio = ratio;
        worstBackground = background;
      }
      if (preparation.indicator) {
        const indicatorAlpha = preparation.indicator[3] * preparation.opacity;
        const effectiveIndicator = [
          preparation.indicator[0] * indicatorAlpha +
            background[0] * (1 - indicatorAlpha),
          preparation.indicator[1] * indicatorAlpha +
            background[1] * (1 - indicatorAlpha),
          preparation.indicator[2] * indicatorAlpha +
            background[2] * (1 - indicatorAlpha),
        ];
        const indicatorLuminance = luminance(...effectiveIndicator);
        const [indicatorLighter, indicatorDarker] = [
          indicatorLuminance,
          backgroundLuminance,
        ].sort((left, right) => right - left);
        minimumIndicatorRatio = Math.min(
          minimumIndicatorRatio,
          (indicatorLighter + 0.05) / (indicatorDarker + 0.05)
        );
      }
      sampledPixels += 1;
    }
  }
  const ringBackgrounds: number[][] = [];
  if (focusImage && preparation.indicator) {
    const scaleX = focusImage.width / preparation.focusClip.width;
    const scaleY = focusImage.height / preparation.focusClip.height;
    for (const point of preparation.ringPoints) {
      const pixelX = Math.max(
        0,
        Math.min(
          focusImage.width - 1,
          Math.round((point.x - preparation.focusClip.x) * scaleX)
        )
      );
      const pixelY = Math.max(
        0,
        Math.min(
          focusImage.height - 1,
          Math.round((point.y - preparation.focusClip.y) * scaleY)
        )
      );
      const offset = (pixelY * focusImage.width + pixelX) * 3;
      ringBackgrounds.push([
        focusImage.pixels[offset],
        focusImage.pixels[offset + 1],
        focusImage.pixels[offset + 2],
      ]);
    }
    minimumIndicatorRatio = Number.POSITIVE_INFINITY;
    for (const background of ringBackgrounds) {
      const backgroundLuminance = luminance(...background);
      const indicatorAlpha = preparation.indicator[3] * preparation.opacity;
      const effectiveIndicator = [
        preparation.indicator[0] * indicatorAlpha +
          background[0] * (1 - indicatorAlpha),
        preparation.indicator[1] * indicatorAlpha +
          background[1] * (1 - indicatorAlpha),
        preparation.indicator[2] * indicatorAlpha +
          background[2] * (1 - indicatorAlpha),
      ];
      const indicatorLuminance = luminance(...effectiveIndicator);
      const [lighter, darker] = [indicatorLuminance, backgroundLuminance].sort(
        (left, right) => right - left
      );
      minimumIndicatorRatio = Math.min(
        minimumIndicatorRatio,
        (lighter + 0.05) / (darker + 0.05)
      );
    }
  }
  const backgroundHistogram = new Map<string, number>();
  for (const image of pixelRects) {
    for (let offset = 0; offset < image.pixels.length; offset += 3) {
      const color = `${image.pixels[offset]},${image.pixels[offset + 1]},${
        image.pixels[offset + 2]
      }`;
      backgroundHistogram.set(color, (backgroundHistogram.get(color) ?? 0) + 1);
    }
  }
  const pixelFingerprint = createHash('sha256');
  for (const image of pixelRects) pixelFingerprint.update(image.pixels);
  const result = {
    label,
    index,
    foreground: `rgba(${preparation.r},${preparation.g},${preparation.b},${preparation.alpha})`,
    ancestorOpacityProduct: Number(preparation.opacity.toFixed(4)),
    effectiveForeground: effectiveForeground.map((value) => Math.round(value)),
    screenshotRects: pixelRects.map(({ width, height }) => ({ width, height })),
    sampledPixels,
    sampledBackgroundSha256: pixelFingerprint.digest('hex'),
    mostFrequentRenderedBackgrounds: [...backgroundHistogram.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 12)
      .map(([rgb, pixels]) => ({ rgb, pixels })),
    worstRenderedBackground: worstBackground,
    minimumRatio: Number(minimumRatio.toFixed(4)),
    focusIndicatorVisible: preparation.outlineVisible,
    focusIndicatorColor: preparation.indicatorColor,
    focusIndicatorContrastRatio: Number.isFinite(minimumIndicatorRatio)
      ? Number(minimumIndicatorRatio.toFixed(4))
      : null,
    focusIndicatorAdjacentBackgrounds: ringBackgrounds,
    focusIndicatorSampling:
      'all four outline perimeter edges sampled every 2 CSS pixels including corners, from actual rendered screenshot with outline temporarily hidden',
    focusRingDistanceCssPx: preparation.ringDistance,
    textRectsAvailable: preparation.textRectsAvailable,
    method:
      'temporary transparent text; descendant fills hidden; target, ancestor and pseudo backgrounds retained; all captured PNG pixels sampled',
  };
  record({ type: 'rendered-pixel-contrast', ...result });
  expect(sampledPixels, `${label}[${index}] rendered pixels`).toBeGreaterThan(
    0
  );
  expect(
    minimumRatio,
    `${label}[${index}] rendered-pixel text contrast`
  ).toBeGreaterThanOrEqual(4.5);
  return result;
}

async function measureRenderedUnderlineContrast(
  page: import('@playwright/test').Page,
  selector: string,
  index: number,
  label: string
): Promise<Record<string, unknown>> {
  const target = page.locator(selector).nth(index);
  await target.scrollIntoViewIfNeeded();
  await target.evaluate(async (element) => {
    const snapshot = () => {
      const rect = element.getBoundingClientRect();
      const styles: string[] = [
        `${rect.x}:${rect.y}:${rect.width}:${rect.height}`,
      ];
      let current: Element | null = element;
      while (current) {
        const style = getComputedStyle(current);
        styles.push(
          `${style.color}:${style.backgroundColor}:${style.backgroundImage}:${style.opacity}`
        );
        current = current.parentElement;
      }
      const pseudo = getComputedStyle(element, '::after');
      styles.push(
        `${pseudo.backgroundColor}:${pseudo.opacity}:${pseudo.transform}:${pseudo.bottom}:${pseudo.height}`
      );
      return styles.join('|');
    };
    let previous = snapshot();
    let stableSamples = 0;
    const deadline = Date.now() + 5_000;
    while (stableSamples < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = snapshot();
      stableSamples = current === previous ? stableSamples + 1 : 0;
      previous = current;
      if (Date.now() > deadline) {
        throw new Error('Underline and adjacent surface styles did not settle');
      }
    }
  });
  const geometry = await target.evaluate((element) => {
    const pseudo = getComputedStyle(element, '::after');
    const rect = element.getBoundingClientRect();
    const number = (value: string) => Number.parseFloat(value) || 0;
    const bottom = number(pseudo.bottom);
    const height = number(pseudo.height);
    const left = number(pseudo.left);
    const right = number(pseudo.right);
    return {
      content: pseudo.content,
      color: pseudo.backgroundColor,
      opacity: Number.parseFloat(pseudo.opacity),
      width: rect.width - left - right,
      height,
      x: rect.left + left,
      y: rect.bottom - bottom - height,
    };
  });
  expect(geometry.content, `${label}: underline pseudo must exist`).not.toBe(
    'none'
  );
  expect(
    geometry.opacity,
    `${label}: underline opacity must be measurable`
  ).toBe(1);
  expect(
    geometry.width,
    `${label}: underline width must be positive`
  ).toBeGreaterThan(0);
  expect(
    geometry.height,
    `${label}: underline height must be positive`
  ).toBeGreaterThan(0);

  const padding = 3;
  const clip = {
    x: Math.max(0, Math.floor(geometry.x)),
    y: Math.max(0, Math.floor(geometry.y - padding)),
    width: Math.max(1, Math.ceil(geometry.width)),
    height: Math.max(1, Math.ceil(geometry.height + padding * 2)),
  };
  const token = `underline-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const attr = 'data-rr09-i05-underline-mask';
  let lineImage: ReturnType<typeof decodePng>;
  let backgroundImage: ReturnType<typeof decodePng>;
  try {
    lineImage = decodePng(
      await page.screenshot({ clip, animations: 'disabled' })
    );
    await target.evaluate(
      (element, { attr, token }) => {
        element.setAttribute(attr, token);
        const style = document.createElement('style');
        style.setAttribute('data-rr09-i05-underline-style', token);
        style.textContent = `[${attr}="${token}"]::after { visibility: hidden !important; transition: none !important; animation: none !important; }`;
        document.head.appendChild(style);
      },
      { attr, token }
    );
    backgroundImage = decodePng(
      await page.screenshot({ clip, animations: 'disabled' })
    );
  } finally {
    await target.evaluate(
      (element, { attr, token }) => {
        if (element.getAttribute(attr) === token) element.removeAttribute(attr);
        document
          .querySelector(`[data-rr09-i05-underline-style="${token}"]`)
          ?.remove();
      },
      { attr, token }
    );
  }

  const scaleX = lineImage.width / clip.width;
  const scaleY = lineImage.height / clip.height;
  const startX = Math.max(0, Math.floor((geometry.x - clip.x) * scaleX));
  const endX = Math.min(
    lineImage.width,
    Math.ceil((geometry.x + geometry.width - clip.x) * scaleX)
  );
  const centerStart = startX + Math.floor((endX - startX) * 0.1);
  const centerEnd = Math.max(
    centerStart + 1,
    endX - Math.floor((endX - startX) * 0.1)
  );
  const lineTop = Math.max(0, Math.floor((geometry.y - clip.y) * scaleY));
  const lineBottom = Math.min(
    lineImage.height,
    Math.ceil((geometry.y + geometry.height - clip.y) * scaleY)
  );
  const lineY = Math.min(
    lineImage.height - 1,
    Math.max(lineTop, Math.floor((lineTop + lineBottom - 1) / 2))
  );
  const backgroundYs = [lineTop - 1, lineBottom].filter(
    (y) => y >= 0 && y < backgroundImage.height
  );
  const rgb = (image: ReturnType<typeof decodePng>, x: number, y: number) => {
    const offset = (y * image.width + x) * 3;
    return [
      image.pixels[offset],
      image.pixels[offset + 1],
      image.pixels[offset + 2],
    ];
  };
  const luminance = (color: number[]) => {
    const channels = color.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const ratios: number[] = [];
  const lineColors = new Map<string, number>();
  const backgroundColors = new Map<string, number>();
  for (let x = centerStart; x < centerEnd; x += 1) {
    const foreground = rgb(lineImage, x, lineY);
    const foregroundKey = foreground.join(',');
    lineColors.set(foregroundKey, (lineColors.get(foregroundKey) ?? 0) + 1);
    const adjacentSurfaces = backgroundYs.map((y) => rgb(lineImage, x, y));
    adjacentSurfaces.push(rgb(backgroundImage, x, lineY));
    for (const background of adjacentSurfaces) {
      const backgroundKey = background.join(',');
      backgroundColors.set(
        backgroundKey,
        (backgroundColors.get(backgroundKey) ?? 0) + 1
      );
      const values = [luminance(foreground), luminance(background)].sort(
        (a, b) => b - a
      );
      ratios.push((values[0] + 0.05) / (values[1] + 0.05));
    }
  }
  expect(ratios.length, `${label}: rendered underline samples`).toBeGreaterThan(
    0
  );
  const minimumRatio = Math.min(...ratios);
  const evidence = {
    label,
    selector,
    geometry,
    lineSampleCount: centerEnd - centerStart,
    adjacentSurfaceSampleCount: ratios.length,
    minimumRatio: Number(minimumRatio.toFixed(4)),
    actualRenderedLineColors: Array.from(lineColors.entries()).map(
      ([color, count]) => ({ color, count })
    ),
    actualAdjacentSurfaceColors: Array.from(backgroundColors.entries()).map(
      ([color, count]) => ({ color, count })
    ),
    method:
      'normal rendered screenshot line pixels compared against immediate rendered pixels above and below the line and same-position underlay pixels captured with only the ::after underline hidden',
  };
  record({ type: 'rendered-underline-contrast', ...evidence });
  expect(
    minimumRatio,
    `${label}: rendered underline contrast`
  ).toBeGreaterThanOrEqual(3);
  return evidence;
}

async function capture(
  page: import('@playwright/test').Page,
  label: string,
  selector: string,
  state: string
): Promise<void> {
  const evidence = await page.evaluate(
    ({ targetSelector, requestedState }) => {
      const parse = (input: string): [number, number, number, number] => {
        const context = document.createElement('canvas').getContext('2d');
        if (!context) throw new Error('Canvas color parser unavailable');
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = input;
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
        return [r, g, b, a / 255];
      };
      const composite = (
        fg: [number, number, number, number],
        bg: [number, number, number, number]
      ): [number, number, number, number] => {
        const alpha = fg[3] + bg[3] * (1 - fg[3]);
        if (!alpha) return [0, 0, 0, 0];
        return [
          (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / alpha,
          (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / alpha,
          (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / alpha,
          alpha,
        ];
      };
      const luminance = (color: [number, number, number, number]) => {
        const channels = color.slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return (
          0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        );
      };
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(targetSelector)
      );
      return {
        route: location.pathname,
        theme: document.documentElement.getAttribute('data-theme'),
        state: requestedState,
        selector: targetSelector,
        count: targets.length,
        measurements: targets.map((target) => {
          const style = getComputedStyle(target);
          const rect = target.getBoundingClientRect();
          const layers: Array<{
            tag: string;
            className: string;
            color: string;
            image: string;
            opacity: string;
          }> = [];
          let current: Element | null = target;
          let background: [number, number, number, number] = [0, 0, 0, 0];
          while (current) {
            const ancestor = getComputedStyle(current);
            const color = ancestor.backgroundColor;
            layers.push({
              tag: current.tagName.toLowerCase(),
              className:
                typeof current.className === 'string' ? current.className : '',
              color,
              image: ancestor.backgroundImage,
              opacity: ancestor.opacity,
            });
            background = composite(parse(color), background);
            if (background[3] >= 0.99) break;
            current = current.parentElement;
          }
          if (background[3] < 1) {
            background = composite(background, [255, 255, 255, 1]);
          }
          const foreground = parse(style.color);
          const opaqueForeground = composite(foreground, background);
          const values = [
            luminance(opaqueForeground),
            luminance(background),
          ].sort((left, right) => right - left);
          const ratio = (values[0] + 0.05) / (values[1] + 0.05);
          const ancestors: Element[] = [];
          let ancestor: Element | null = target;
          while (ancestor) {
            ancestors.push(ancestor);
            ancestor = ancestor.parentElement;
          }
          const opacityLayers = ancestors.map((element) =>
            Number.parseFloat(getComputedStyle(element).opacity)
          );
          const imageLayers = layers
            .map((layer) => layer.image)
            .filter((image) => image !== 'none');
          const opacityComposed = opacityLayers.every(
            (opacity) => opacity >= 0.99
          );
          const solidBackgroundOnly = imageLayers.length === 0;
          const outlineVisible =
            style.outlineStyle !== 'none' &&
            Number.parseFloat(style.outlineWidth) > 0;
          const shadowColor =
            style.boxShadow.match(/rgba?\([^)]*\)/)?.[0] ?? null;
          const focusIndicatorColor = outlineVisible
            ? style.outlineColor
            : shadowColor;
          const focusIndicatorVisible =
            outlineVisible || style.boxShadow !== 'none';
          const focusIndicatorContrastRatio = focusIndicatorColor
            ? (() => {
                const paintedIndicator = composite(
                  parse(focusIndicatorColor),
                  background
                );
                const values = [
                  luminance(paintedIndicator),
                  luminance(background),
                ].sort((left, right) => right - left);
                return Number(
                  ((values[0] + 0.05) / (values[1] + 0.05)).toFixed(4)
                );
              })()
            : null;
          return {
            text: target.textContent?.trim().slice(0, 100) ?? '',
            foreground: style.color,
            effectiveBackground: `rgb(${Math.round(
              background[0]
            )}, ${Math.round(background[1])}, ${Math.round(background[2])})`,
            backgroundImage: style.backgroundImage,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            transitionProperty: style.transitionProperty,
            transitionDuration: style.transitionDuration,
            ancestorCssRatio:
              opacityComposed && solidBackgroundOnly
                ? Number(ratio.toFixed(4))
                : null,
            ancestorCssRatioLimit:
              opacityComposed && solidBackgroundOnly
                ? 'solid alpha-composited CSS colors; all ancestor opacity >= .99'
                : 'not calculated: image background or ancestor opacity requires rendered-pixel analysis',
            focused: document.activeElement === target,
            focusVisible: target.matches(':focus-visible'),
            outline: `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`,
            boxShadow: style.boxShadow,
            focusIndicatorVisible,
            focusIndicatorColor,
            focusIndicatorContrastRatio,
            activeIndicator: target.matches('.nav-tab.active')
              ? (() => {
                  const indicator = getComputedStyle(target, '::after');
                  const adjacent = target.parentElement
                    ? getComputedStyle(target.parentElement).borderBottomColor
                    : 'rgba(0,0,0,0)';
                  const luminanceOf = (value: string) => {
                    const context = document
                      .createElement('canvas')
                      .getContext('2d');
                    if (!context)
                      throw new Error('Canvas color parser unavailable');
                    context.fillStyle = value;
                    context.fillRect(0, 0, 1, 1);
                    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
                    const channels = [r, g, b].map((channel) => {
                      const normalized = channel / 255;
                      return normalized <= 0.04045
                        ? normalized / 12.92
                        : ((normalized + 0.055) / 1.055) ** 2.4;
                    });
                    return (
                      0.2126 * channels[0] +
                      0.7152 * channels[1] +
                      0.0722 * channels[2]
                    );
                  };
                  const [lighter, darker] = [
                    luminanceOf(indicator.backgroundColor),
                    luminanceOf(adjacent),
                  ].sort((left, right) => right - left);
                  return {
                    content: indicator.content,
                    width: indicator.width,
                    height: indicator.height,
                    background: indicator.backgroundColor,
                    opacity: indicator.opacity,
                    adjacentBackground: adjacent,
                    contrastRatio: Number(
                      ((lighter + 0.05) / (darker + 0.05)).toFixed(4)
                    ),
                  };
                })()
              : null,
            visible: rect.width > 0 && rect.height > 0,
            layers,
          };
        }),
      };
    },
    { targetSelector: selector, requestedState: state }
  );
  record({ type: 'contrast-sample', label, ...evidence });
  if (selector.includes('.subtitle')) {
    const badgeSelector = `${selector} .edited-badge`;
    const badgeCount = await page.locator(badgeSelector).count();
    record({
      type: 'subtitle-badge-presence',
      label,
      selector: badgeSelector,
      count: badgeCount,
      independentlyMeasured: badgeCount > 0,
    });
    for (let badgeIndex = 0; badgeIndex < badgeCount; badgeIndex += 1) {
      await measureRenderedPixelContrast(
        page,
        badgeSelector,
        badgeIndex,
        `${label}-edited-badge`
      );
    }
  }
  expect(evidence.count, `${label}: target must be present`).toBeGreaterThan(0);
  for (const [index, measurement] of evidence.measurements.entries()) {
    expect(measurement.visible, `${label}[${index}] must be visible`).toBe(
      true
    );
    const renderedPixelMeasurement = (await measureRenderedPixelContrast(
      page,
      selector,
      index,
      label
    )) as {
      focusIndicatorVisible: boolean;
      focusIndicatorContrastRatio: number | null;
    };
    if (measurement.activeIndicator)
      await measureRenderedUnderlineContrast(page, selector, index, label);
    if (state === 'keyboard-focus-visible') {
      expect(
        measurement.focusVisible,
        `${label}[${index}] must match :focus-visible`
      ).toBe(true);
      expect(
        renderedPixelMeasurement.focusIndicatorVisible,
        `${label}[${index}] must show a focus indicator`
      ).toBe(true);
      expect(
        renderedPixelMeasurement.focusIndicatorContrastRatio,
        `${label}[${index}] focus indicator contrast`
      ).toBeGreaterThanOrEqual(3);
    }
  }
  const locator = page.locator(selector).first();
  if ((await locator.count()) > 0 && (await locator.isVisible())) {
    await locator.screenshot({
      path: join(evidenceDir, `${label}.png`),
      animations: 'disabled',
    });
    chmodSync(join(evidenceDir, `${label}.png`), 0o600);
  }
}

async function recordAxeContrast(
  page: import('@playwright/test').Page,
  label: string,
  matcher: string
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  const findings = [
    ...results.violations.map((violation) => ({
      impact: 'violation',
      violation,
    })),
    ...results.incomplete.map((violation) => ({
      impact: 'incomplete',
      violation,
    })),
  ];
  const nodes = findings
    .filter(({ violation }) => violation.id === 'color-contrast')
    .flatMap(({ impact, violation }) =>
      violation.nodes.map((node) => ({ impact, node }))
    )
    .filter(({ node }) =>
      node.target.some((target) => target.includes(matcher))
    )
    .map(({ impact, node }) => ({
      impact,
      target: node.target,
      failureSummary: node.failureSummary,
      any: node.any.map((check) => check.message),
    }));
  const violations = nodes.filter(({ impact }) => impact === 'violation');
  record({
    type: 'axe-contrast',
    label,
    theme: await page.locator('html').getAttribute('data-theme'),
    matcher,
    violationCount: results.violations.filter(
      (violation) => violation.id === 'color-contrast'
    ).length,
    incompleteCount: results.incomplete.filter(
      (violation) => violation.id === 'color-contrast'
    ).length,
    nodes,
  });
  expect(
    violations,
    `${label}: targeted color-contrast Axe violations`
  ).toHaveLength(0);
}

async function operateTheme(
  page: import('@playwright/test').Page,
  target: 'light' | 'dark'
): Promise<void> {
  const trigger = page.getByRole('button', { name: 'Appearance', exact: true });
  await trigger.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Appearance controls' });
  const toggle = dialog.locator('input[type="checkbox"]');
  if ((await toggle.isChecked()) !== (target === 'dark')) {
    await toggle.focus();
    await page.keyboard.press('Space');
  }
  await expect(toggle).toHaveJSProperty('checked', target === 'dark');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-theme', target);
  await page.evaluate(async () => {
    const read = () => {
      const body = getComputedStyle(document.body);
      return JSON.stringify({
        theme: document.documentElement.getAttribute('data-theme'),
        foreground: body.color,
        background: body.backgroundColor,
      });
    };
    let previous = read();
    let stable = 0;
    const deadline = Date.now() + 5_000;
    while (stable < 7) {
      await new Promise<void>((resolve) => setTimeout(resolve, 50));
      const current = read();
      stable = current === previous ? stable + 1 : 0;
      previous = current;
      if (Date.now() > deadline) throw new Error('Theme did not settle');
    }
  });
}

async function focusByKeyboard(
  page: import('@playwright/test').Page,
  selector: string
): Promise<boolean> {
  await page.evaluate(() => document.activeElement?.blur());
  const target = page.locator(selector).first();
  for (let index = 0; index < 100; index += 1) {
    await page.keyboard.press('Tab');
    if (
      await target.evaluate((element) => element === document.activeElement)
    ) {
      return true;
    }
  }
  return false;
}

async function settle(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  );
}

async function sampleTransition(
  page: import('@playwright/test').Page,
  selector: string,
  label: string
): Promise<void> {
  const result = await page.evaluate(async (targetSelector) => {
    const parse = (value: string): [number, number, number] => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas color parser unavailable');
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b];
    };
    const luminance = (value: string) => {
      const [r, g, b] = parse(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const rgba = (value: string): [number, number, number, number] => {
      const context = document.createElement('canvas').getContext('2d');
      if (!context) throw new Error('Canvas color parser unavailable');
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, alpha / 255];
    };
    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(targetSelector)
    );
    const started = performance.now();
    let frames = 0;
    let minimumRatio = Number.POSITIVE_INFINITY;
    let worst: Record<string, string | number> | null = null;
    await new Promise<void>((resolve) => {
      const sample = () => {
        for (const [index, target] of targets.entries()) {
          const style = getComputedStyle(target);
          let current: Element | null = target;
          let background: [number, number, number, number] = [0, 0, 0, 0];
          let backgroundLayers: string[] = [];
          let hasImageBackground = false;
          let hasOpacityLayer = false;
          while (current) {
            const ancestorStyle = getComputedStyle(current);
            backgroundLayers.push(
              `${ancestorStyle.backgroundColor}|${ancestorStyle.backgroundImage}|opacity:${ancestorStyle.opacity}`
            );
            hasImageBackground ||= ancestorStyle.backgroundImage !== 'none';
            hasOpacityLayer ||= Number.parseFloat(ancestorStyle.opacity) < 0.99;
            const layer = rgba(ancestorStyle.backgroundColor);
            const alpha = layer[3] + background[3] * (1 - layer[3]);
            if (alpha > 0) {
              background = [
                (layer[0] * layer[3] +
                  background[0] * background[3] * (1 - layer[3])) /
                  alpha,
                (layer[1] * layer[3] +
                  background[1] * background[3] * (1 - layer[3])) /
                  alpha,
                (layer[2] * layer[3] +
                  background[2] * background[3] * (1 - layer[3])) /
                  alpha,
                alpha,
              ];
            }
            if (background[3] >= 0.99) break;
            current = current.parentElement;
          }
          if (background[3] < 1) {
            background = [
              background[0] * background[3] + 255 * (1 - background[3]),
              background[1] * background[3] + 255 * (1 - background[3]),
              background[2] * background[3] + 255 * (1 - background[3]),
              1,
            ];
          }
          if (hasImageBackground || hasOpacityLayer) {
            throw new Error(
              'Transition contrast background requires rendered-pixel analysis'
            );
          }
          const backgroundColor = `rgb(${background[0]}, ${background[1]}, ${background[2]})`;
          const colors = [
            luminance(style.color),
            luminance(backgroundColor),
          ].sort((left, right) => right - left);
          const ratio = (colors[0] + 0.05) / (colors[1] + 0.05);
          if (ratio < minimumRatio) {
            minimumRatio = ratio;
            worst = {
              targetIndex: index,
              foreground: style.color,
              background: backgroundColor,
              backgroundLayers: JSON.stringify(backgroundLayers),
              transitionProperty: style.transitionProperty,
              transitionDuration: style.transitionDuration,
              ratio: Number(ratio.toFixed(4)),
            };
          }
        }
        frames += 1;
        if (performance.now() - started >= 400) resolve();
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    return {
      selector: targetSelector,
      count: targets.length,
      frames,
      minimumRatio,
      worst,
    };
  }, selector);
  record({
    type: 'transition-sample',
    label,
    route: new URL(page.url()).pathname,
    ...result,
  });
  expect(
    result.count,
    `${label}: transition target must be present`
  ).toBeGreaterThan(0);
  expect(
    result.frames,
    `${label}: must sample more than two rendered frames`
  ).toBeGreaterThan(2);
  expect(
    Number.isFinite(result.minimumRatio),
    `${label}: transition ratio must be measurable`
  ).toBe(true);
  expect(
    result.minimumRatio,
    `${label}: transition contrast`
  ).toBeGreaterThanOrEqual(4.5);
}

test('RR09-I05 authenticated contrast acceptance', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(
    !enabled,
    'Set RR09_I05_LIVE_STACK=true for the authorized live probe'
  );
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  await page.goto(`${origin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });

  const initialTheme =
    (await page.locator('html').getAttribute('data-theme')) === 'dark'
      ? 'dark'
      : 'light';
  const themes: Array<'light' | 'dark'> = [
    initialTheme,
    initialTheme === 'dark' ? 'light' : 'dark',
  ];
  let discoveredCommunityRoute: string | null = null;
  let fixtureCommunityPostCount: number | null = null;
  const fixtureRows = readFileSync(fixtureJournalPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const fixture = [...fixtureRows]
    .map((row, index) => ({ row, index }))
    .reverse()
    .find(({ row, index }) => {
      if (
        row.type !== 'fixture-post-created' &&
        row.type !== 'fixture-post-created-rerun'
      ) {
        return false;
      }
      const postId = row.postId;
      return !fixtureRows
        .slice(index + 1)
        .some(
          (later) =>
            later.postId === postId && later.type === 'fixture-cleanup-post'
        );
    })?.row;
  const fixtureCommunityId =
    typeof fixture?.communityId === 'string' ? fixture.communityId : null;
  const fixturePostId =
    typeof fixture?.postId === 'string' ? fixture.postId : null;
  const fixtureProfileId =
    typeof fixture?.profileId === 'string' ? fixture.profileId : null;
  expect(fixtureCommunityId, 'prepared community fixture ID').not.toBeNull();
  expect(fixturePostId, 'prepared post fixture ID').not.toBeNull();
  expect(fixtureProfileId, 'prepared fixture owner profile ID').not.toBeNull();
  const isFixtureCommunityPostList = (
    response: import('@playwright/test').Response
  ): boolean => {
    if (
      !response.url().includes('/api/social/post/find') ||
      response.request().method() !== 'POST'
    ) {
      return false;
    }
    try {
      return (
        response.request().postDataJSON()?.criteria?.communityId ===
        fixtureCommunityId
      );
    } catch {
      return false;
    }
  };
  try {
    for (const theme of themes) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await operateTheme(page, theme);
      }

      const topActiveResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/social/community/top-active'),
        { timeout: 15_000 }
      );
      const searchResponse = page.waitForResponse(
        (response) => response.url().includes('/api/social/community/search'),
        { timeout: 15_000 }
      );
      await page.goto(`${origin}/communities`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(
        page.getByRole('heading', { name: 'Communities' })
      ).toBeVisible();
      await Promise.all([topActiveResponse, searchResponse]);
      await capture(
        page,
        `shell-subtitle-${theme}`,
        '.community-header .subtitle',
        'base'
      );
      await recordAxeContrast(page, `shell-subtitle-${theme}`, '.subtitle');
      const shellTabs = page.locator('.community-nav .nav-tab');
      await expect(shellTabs.first()).toBeVisible();
      record({
        type: 'community-discovery',
        theme,
        cardCount: await page.locator('lib-find-communities otui-card').count(),
        exploreButtonCount: await page
          .getByRole('button', { name: 'Explore', exact: true })
          .count(),
        groupCount: await page.locator('.groups-sidebar .group-item').count(),
      });
      await capture(
        page,
        `shell-nav-${theme}`,
        '.community-nav .nav-tab',
        'base'
      );
      const shellHoverSample = sampleTransition(
        page,
        '.community-nav .nav-tab:nth-child(2)',
        `shell-nav-hover-${theme}`
      );
      await shellTabs.nth(1).hover();
      await shellHoverSample;
      await settle(page);
      await capture(
        page,
        `shell-nav-hover-${theme}`,
        '.community-nav .nav-tab:nth-child(2)',
        'hover'
      );
      const shellKeyboardFocused = await focusByKeyboard(
        page,
        '.community-nav .nav-tab:nth-child(2)'
      );
      record({
        type: 'keyboard-focus',
        target: '.community-nav .nav-tab:nth-child(2)',
        theme,
        reachedByTab: shellKeyboardFocused,
      });
      expect(
        shellKeyboardFocused,
        `${theme}: shell navigation must be keyboard reachable`
      ).toBe(true);
      if (shellKeyboardFocused)
        await capture(
          page,
          `shell-nav-focus-${theme}`,
          '.community-nav .nav-tab:nth-child(2)',
          'keyboard-focus-visible'
        );
      await shellTabs.first().click();
      await capture(
        page,
        `shell-nav-active-${theme}`,
        '.community-nav .nav-tab.active',
        'active'
      );
      await recordAxeContrast(page, `shell-nav-active-${theme}`, '.nav-tab');

      if (!discoveredCommunityRoute) {
        const sessionResponse = await page.request.get(
          `${origin}/api/authentication/session`,
          {
            headers: {
              'X-ot-appscope': 'client-interface',
              'X-ot-app-id': 'client-interface',
            },
            timeout: 4_000,
          }
        );
        const sessionPayload = await sessionResponse.json();
        expect(sessionResponse.ok()).toBe(true);
        expect(sessionPayload?.data?.profileId).toBe(fixtureProfileId);
        const fixturePostResponse = await page.request.get(
          `${origin}/api/social/post/${fixturePostId}`,
          {
            headers: {
              'X-ot-appscope': 'client-interface',
              'X-ot-app-id': 'client-interface',
            },
            timeout: 4_000,
          }
        );
        const fixturePost = await fixturePostResponse.json();
        record({
          type: 'prepared-fixture-post-readback',
          status: fixturePostResponse.status(),
          postId: fixturePost?.id ?? null,
          communityId: fixturePost?.communityId ?? null,
          profileId: fixturePost?.profileId ?? null,
        });
        expect(fixturePostResponse.ok()).toBe(true);
        expect(fixturePost.id).toBe(fixturePostId);
        expect(fixturePost.communityId).toBe(fixtureCommunityId);
        expect(fixturePost.profileId).toBe(fixtureProfileId);
        const fixtureCommunityResponse = await page.request.get(
          `${origin}/api/social/community/${fixtureCommunityId}`,
          {
            headers: {
              'X-ot-appscope': 'client-interface',
              'X-ot-app-id': 'client-interface',
            },
            timeout: 4_000,
          }
        );
        const fixtureCommunity = await fixtureCommunityResponse.json();
        expect(fixtureCommunityResponse.ok()).toBe(true);
        expect(fixtureCommunity.isPrivate).toBe(false);
        expect(fixtureCommunity.slug).toEqual(expect.any(String));
        const fixtureRoute = `/communities/${encodeURIComponent(
          fixtureCommunity.slug
        )}/posts`;
        const communityPostListResponse = page.waitForResponse(
          isFixtureCommunityPostList
        );
        await page.goto(`${origin}${fixtureRoute}`, {
          waitUntil: 'domcontentloaded',
        });
        const communityPostResponse = await communityPostListResponse;
        const communityPosts = await communityPostResponse.json();
        const postRows = Array.isArray(communityPosts)
          ? communityPosts.map((post: Record<string, unknown>) => ({
              id: post.id ?? null,
              communityId: post.communityId ?? null,
              profileId: post.profileId ?? null,
              createdAt: post.createdAt ?? null,
              visibility: post.visibility ?? null,
              titleHash:
                typeof post.title === 'string'
                  ? createHash('sha256').update(post.title).digest('hex')
                  : null,
            }))
          : [];
        fixtureCommunityPostCount = postRows.length;
        record({
          type: 'community-post-list-readback',
          status: communityPostResponse.status(),
          exactCommunityId: fixtureCommunityId,
          returnedCount: postRows.length,
          fixturePostReturned: postRows.some(
            (post) => post.id === fixturePostId
          ),
          allRowsMatchCommunity: postRows.every(
            (post) => post.communityId === fixtureCommunityId
          ),
          rows: postRows,
        });
        expect(
          communityPostResponse.ok(),
          `${theme}: community post list response`
        ).toBe(true);
        expect(
          postRows.some((post) => post.id === fixturePostId),
          `${theme}: exact fixture appears in community response`
        ).toBe(true);
        expect(
          postRows.every((post) => post.communityId === fixtureCommunityId),
          `${theme}: community response rows belong to exact community`
        ).toBe(true);
        await page
          .locator('.posts-nav .nav-tab')
          .first()
          .waitFor({ state: 'visible', timeout: 8_000 })
          .catch(() => undefined);
        await page
          .locator('lib-post .subtitle')
          .first()
          .waitFor({ state: 'visible', timeout: 8_000 })
          .catch(() => undefined);
        const fixtureNavCount = await page
          .locator('.posts-nav .nav-tab')
          .count();
        const fixtureSubtitleCount = await page
          .locator('lib-post .subtitle')
          .count();
        record({
          type: 'prepared-fixture-route',
          communityId: fixtureCommunityId,
          postId: fixturePostId,
          route: fixtureRoute,
          exactFixtureReadbackCount: 1,
          communityListResponseCount: fixtureCommunityPostCount,
          navCount: fixtureNavCount,
          subtitleCount: fixtureSubtitleCount,
        });
        expect(
          fixtureNavCount,
          `${theme}: exact fixture community posts navigation`
        ).toBeGreaterThan(0);
        expect(
          fixtureSubtitleCount,
          `${theme}: exact fixture community post subtitle`
        ).toBeGreaterThan(0);
        discoveredCommunityRoute = new URL(page.url()).pathname;
      }

      if (discoveredCommunityRoute) {
        const fixtureUrl = new URL(discoveredCommunityRoute, origin);
        if (new URL(page.url()).pathname !== discoveredCommunityRoute) {
          const currentCommunityPostListResponse = page.waitForResponse(
            isFixtureCommunityPostList
          );
          await page.goto(fixtureUrl.toString(), {
            waitUntil: 'domcontentloaded',
          });
          const currentCommunityPostResponse =
            await currentCommunityPostListResponse;
          const currentCommunityPosts =
            await currentCommunityPostResponse.json();
          const currentPostRows = Array.isArray(currentCommunityPosts)
            ? currentCommunityPosts.map((post: Record<string, unknown>) => ({
                id: post.id ?? null,
                communityId: post.communityId ?? null,
                profileId: post.profileId ?? null,
                createdAt: post.createdAt ?? null,
                visibility: post.visibility ?? null,
                titleHash:
                  typeof post.title === 'string'
                    ? createHash('sha256').update(post.title).digest('hex')
                    : null,
              }))
            : [];
          fixtureCommunityPostCount = currentPostRows.length;
          record({
            type: 'community-post-list-readback',
            theme,
            status: currentCommunityPostResponse.status(),
            exactCommunityId: fixtureCommunityId,
            returnedCount: currentPostRows.length,
            fixturePostReturned: currentPostRows.some(
              (post) => post.id === fixturePostId
            ),
            allRowsMatchCommunity: currentPostRows.every(
              (post) => post.communityId === fixtureCommunityId
            ),
            rows: currentPostRows,
          });
          expect(
            currentCommunityPostResponse.ok(),
            `${theme}: exact community post list response`
          ).toBe(true);
          expect(
            currentPostRows.some((post) => post.id === fixturePostId),
            `${theme}: exact fixture appears in community response`
          ).toBe(true);
          expect(
            currentPostRows.every(
              (post) => post.communityId === fixtureCommunityId
            ),
            `${theme}: community response rows belong to exact community`
          ).toBe(true);
        }
        await expect(page).toHaveURL(
          (url) => url.pathname === discoveredCommunityRoute
        );
        await expect(page.locator('lib-community-posts')).toHaveCount(1, {
          timeout: 15_000,
        });
        await expect(
          page.locator('.posts-content .loading'),
          `${theme}: community post loading completes`
        ).toBeHidden({ timeout: 15_000 });
        if (fixtureCommunityPostCount === null) {
          throw new Error(`${theme}: community post response count is missing`);
        }
        await expect(
          page.locator('lib-community-posts lib-post'),
          `${theme}: exact community response rows render`
        ).toHaveCount(fixtureCommunityPostCount, { timeout: 15_000 });
        const renderedCommunityPostCount = await page
          .locator('lib-community-posts lib-post')
          .count();
        record({
          type: 'community-post-rendered-count',
          route: fixtureUrl.pathname,
          theme,
          expectedFromListResponse: fixtureCommunityPostCount,
          rendered: renderedCommunityPostCount,
        });
        expect(fixtureCommunityPostCount).not.toBeNull();
        expect(
          renderedCommunityPostCount,
          `${theme}: rendered community posts match exact list response`
        ).toBe(fixtureCommunityPostCount);
        const postNav = page.locator('.posts-nav .nav-tab');
        await postNav
          .first()
          .waitFor({ state: 'visible', timeout: 10_000 })
          .catch(() => undefined);
        expect(
          await postNav.count(),
          `${theme}: community posts navigation`
        ).toBeGreaterThan(0);
        if ((await postNav.count()) > 0) {
          await expect(postNav.first()).toBeVisible();
          await capture(
            page,
            `posts-nav-${theme}`,
            '.posts-nav .nav-tab',
            'base'
          );
          const postsHoverSample = sampleTransition(
            page,
            '.posts-nav .nav-tab:nth-child(1)',
            `posts-nav-hover-${theme}`
          );
          await postNav.nth(0).hover();
          await postsHoverSample;
          await settle(page);
          await capture(
            page,
            `posts-nav-hover-${theme}`,
            '.posts-nav .nav-tab:nth-child(1)',
            'hover'
          );
          const postsKeyboardFocused = await focusByKeyboard(
            page,
            '.posts-nav .nav-tab:nth-child(1)'
          );
          record({
            type: 'keyboard-focus',
            target: '.posts-nav .nav-tab:nth-child(1)',
            theme,
            reachedByTab: postsKeyboardFocused,
          });
          expect(
            postsKeyboardFocused,
            `${theme}: posts navigation must be keyboard reachable`
          ).toBe(true);
          if (postsKeyboardFocused)
            await capture(
              page,
              `posts-nav-focus-${theme}`,
              '.posts-nav .nav-tab:nth-child(1)',
              'keyboard-focus-visible'
            );
          await postNav.nth(0).click();
          await capture(
            page,
            `posts-nav-active-${theme}`,
            '.posts-nav .nav-tab.active',
            'active'
          );
          await recordAxeContrast(
            page,
            `posts-nav-active-${theme}`,
            '.nav-tab'
          );
          const communitySubtitle = page.locator('lib-post .subtitle');
          await communitySubtitle
            .first()
            .waitFor({ state: 'visible', timeout: 8_000 })
            .catch(() => undefined);
          const communitySubtitleCount = await communitySubtitle.count();
          record({
            type: 'target-readiness',
            target: 'community post subtitle',
            theme,
            count: communitySubtitleCount,
          });
          expect(
            communitySubtitleCount,
            `${theme}: public community post subtitle`
          ).toBeGreaterThan(0);
          if (communitySubtitleCount > 0) {
            await capture(
              page,
              `community-post-subtitle-${theme}`,
              'lib-post .subtitle',
              'base'
            );
            await recordAxeContrast(
              page,
              `community-post-subtitle-${theme}`,
              '.subtitle'
            );
          }
        }
      }

      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      const chatButton = page.locator('.chat-floating-button');
      await expect(
        chatButton,
        `${theme}: chat control must be present`
      ).toHaveCount(1);
      await expect(
        chatButton,
        `${theme}: chat control must be visible`
      ).toBeVisible();
      await capture(
        page,
        `chat-label-collapsed-${theme}`,
        '.chat-floating-button .chat-label',
        'collapsed'
      );
      const chatHoverSample = sampleTransition(
        page,
        '.chat-floating-button .chat-label',
        `chat-label-hover-${theme}`
      );
      await chatButton.hover();
      await chatHoverSample;
      await settle(page);
      await capture(
        page,
        `chat-label-hover-${theme}`,
        '.chat-floating-button .chat-label',
        'hover'
      );
      await recordAxeContrast(page, `chat-label-hover-${theme}`, '.chat-label');
      record({
        type: 'keyboard-capability',
        target: '.chat-floating-button',
        keyboardReachable: false,
        note: 'Current DOM is a non-focusable div; keyboard semantics are a V01 check.',
      });
      await page.goto(`${origin}/feed`, { waitUntil: 'domcontentloaded' });
      const feedReady = Promise.race([
        page
          .waitForResponse(
            (response) => response.url().includes('/api/social/feed'),
            { timeout: 15_000 }
          )
          .catch(() => null),
        page
          .locator('app-feed lib-post')
          .first()
          .waitFor({ state: 'attached', timeout: 15_000 })
          .catch(() => null),
      ]);
      await feedReady;
      if (
        await page
          .locator('app-feed .feed-loading')
          .isVisible()
          .catch(() => false)
      ) {
        await page
          .locator('app-feed .feed-loading')
          .waitFor({ state: 'hidden', timeout: 10_000 })
          .catch(() => undefined);
      }
      const postSubtitles = page.locator('lib-post .subtitle');
      await postSubtitles
        .first()
        .waitFor({ state: 'visible', timeout: 12_000 })
        .catch(() => undefined);
      const feedSubtitleCount = await postSubtitles.count();
      record({
        type: 'target-readiness',
        target: 'feed post subtitle',
        theme,
        count: feedSubtitleCount,
        visible:
          feedSubtitleCount > 0 &&
          (await postSubtitles
            .first()
            .isVisible()
            .catch(() => false)),
      });
      expect(feedSubtitleCount, `${theme}: feed post subtitle`).toBeGreaterThan(
        0
      );
      if (feedSubtitleCount > 0) {
        await capture(
          page,
          `feed-post-subtitle-${theme}`,
          'lib-post .subtitle',
          'base'
        );
        await recordAxeContrast(
          page,
          `feed-post-subtitle-${theme}`,
          '.subtitle'
        );
      }
      const audience = page.locator('#postAudience');
      if ((await audience.count()) > 0 && (await audience.isVisible())) {
        await capture(page, `post-audience-${theme}`, '#postAudience', 'base');
        const audienceHoverSample = sampleTransition(
          page,
          '#postAudience',
          `post-audience-hover-${theme}`
        );
        await audience.hover();
        await audienceHoverSample;
        await settle(page);
        await capture(
          page,
          `post-audience-hover-${theme}`,
          '#postAudience',
          'hover'
        );
        const audienceKeyboardFocused = await focusByKeyboard(
          page,
          '#postAudience'
        );
        record({
          type: 'keyboard-focus',
          target: '#postAudience',
          theme,
          reachedByTab: audienceKeyboardFocused,
        });
        expect(
          audienceKeyboardFocused,
          `${theme}: audience selector must be keyboard reachable`
        ).toBe(true);
        if (audienceKeyboardFocused)
          await capture(
            page,
            `post-audience-focus-${theme}`,
            '#postAudience',
            'keyboard-focus-visible'
          );
        if (audienceKeyboardFocused)
          await recordAxeContrast(
            page,
            `post-audience-focus-${theme}`,
            '#postAudience'
          );
        await audience.blur();
      }
      expect(
        await audience.count(),
        `${theme}: audience selector must exist`
      ).toBeGreaterThan(0);
      expect(
        await audience.isVisible(),
        `${theme}: audience selector must be visible`
      ).toBe(true);
      record({
        type: 'route-availability',
        route: '/feed',
        theme,
        visiblePostSubtitles: await postSubtitles.count(),
        audienceVisible:
          (await audience.count()) > 0 &&
          (await audience.isVisible().catch(() => false)),
      });
    }
  } finally {
    if (
      (await page.locator('html').getAttribute('data-theme')) !== initialTheme
    ) {
      await operateTheme(page, initialTheme);
    }
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
    record({
      type: 'restoration',
      originalThemeRestored:
        (await page.locator('html').getAttribute('data-theme')) ===
        initialTheme,
      communityRouteObserved: discoveredCommunityRoute,
    });
  }
  expect(
    discoveredCommunityRoute,
    'public community route with a rendered post subtitle'
  ).not.toBeNull();
});

test('RR09-I05 LocalHub shared post subtitle contrast', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(
    !enabled,
    'Set RR09_I05_LIVE_STACK=true for the authorized live probe'
  );
  const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8')) as {
    email: string;
    password: string;
  };
  const localHubOrigin = 'http://127.0.0.1:8087';
  const rows = readFileSync(fixtureJournalPath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const fixture = [...rows]
    .reverse()
    .find((row) => row.type === 'fixture-post-created-localhub');
  const communityId = fixture?.communityId;
  const communitySlug = fixture?.slug;
  const postId = fixture?.postId;
  const profileId = fixture?.profileId;
  expect(communityId, 'LocalHub fixture community ID').toEqual(
    '3bd16edb-3a0e-40c1-b382-f014d0f0bbd6'
  );
  expect(communitySlug, 'LocalHub fixture community slug').toEqual(
    'permission-community-1791286545022'
  );
  expect(typeof postId, 'LocalHub fixture post ID').toBe('string');
  expect(typeof profileId, 'LocalHub fixture profile ID').toBe('string');

  await page.goto(`${localHubOrigin}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  const session = await page.evaluate(async () => {
    const response = await fetch('/api/authentication/session', {
      headers: { 'X-ot-appscope': 'local-hub', 'X-ot-app-id': 'local-hub' },
    });
    const body = await response.json();
    return {
      status: response.status,
      profileId: body?.data?.profileId,
      userId: body?.data?.userId,
    };
  });
  expect(session.status, 'LocalHub authenticated session').toBe(200);
  expect(session.profileId, 'LocalHub existing owned profile').toBe(profileId);
  record({
    type: 'cross-app-session',
    app: 'local-hub',
    status: session.status,
    profileId: session.profileId,
    userId: session.userId,
    fixturePostId: postId,
  });

  const initialTheme =
    (await page.locator('html').getAttribute('data-theme')) === 'dark'
      ? 'dark'
      : 'light';
  const themes: Array<'light' | 'dark'> = [
    initialTheme,
    initialTheme === 'dark' ? 'light' : 'dark',
  ];
  const route = `/c/${communitySlug}`;
  try {
    for (const theme of themes) {
      if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
        await operateTheme(page, theme);
      }
      let listRequestCriteria: unknown = null;
      let listRequestAppScope: string | undefined;
      const listResponsePromise = page.waitForResponse((response) => {
        if (
          !response.url().includes('/api/social/post/find') ||
          response.request().method() !== 'POST'
        ) {
          return false;
        }
        try {
          const criteria = response.request().postDataJSON()?.criteria;
          if (criteria?.communityId !== communityId) return false;
          listRequestCriteria = criteria;
          listRequestAppScope = response.request().headers()['x-ot-appscope'];
          return true;
        } catch {
          return false;
        }
      });
      await page.goto(`${localHubOrigin}${route}`, {
        waitUntil: 'domcontentloaded',
      });
      await expect(page).toHaveURL(new RegExp(`${route}$`));
      const listResponse = await listResponsePromise;
      expect(
        listResponse.status(),
        `${theme}: LocalHub community posts API`
      ).toBe(201);
      const listRows = await listResponse.json();
      expect(Array.isArray(listRows), `${theme}: LocalHub post rows`).toBe(
        true
      );
      expect(
        listRequestAppScope,
        `${theme}: LocalHub app-scope request header`
      ).toBe('local-hub');
      const rowScopeCounts = listRows.reduce(
        (counts: Record<string, number>, row: { appScope?: unknown }) => {
          const key =
            typeof row.appScope === 'string' ? row.appScope : '(missing)';
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        },
        {}
      );
      record({
        type: 'cross-app-community-response',
        app: 'local-hub',
        route,
        theme,
        status: listResponse.status(),
        requestCriteria: listRequestCriteria,
        returnedRows: listRows.map(
          (row: {
            id: string;
            communityId?: string;
            profileId?: string;
            appScope?: unknown;
            visibility?: unknown;
          }) => ({
            id: row.id,
            communityId: row.communityId ?? null,
            profileId: row.profileId ?? null,
            appScope: row.appScope ?? null,
            visibility: row.visibility ?? null,
          })
        ),
        appScopeCounts: rowScopeCounts,
      });
      expect(
        listRows.map((row: { id: string }) => row.id),
        `${theme}: exact LocalHub fixture in scoped response`
      ).toContain(postId);
      expect(
        listRows.every(
          (row: { communityId: string }) => row.communityId === communityId
        ),
        `${theme}: response rows belong to exact community`
      ).toBe(true);

      await expect(page.locator('app-community')).toHaveCount(1);
      await expect(page.locator('lib-community-posts')).toHaveCount(1);
      await expect(page.locator('lib-community-posts .posts-nav')).toHaveCount(
        0
      );
      const fixtureRow = listRows.find(
        (row: { id: string }) => row.id === postId
      );
      expect(
        fixtureRow?.profileId,
        `${theme}: exact LocalHub fixture owner profile`
      ).toBe(profileId);
      expect(fixtureRow?.title, `${theme}: fixture title in response`).toEqual(
        expect.any(String)
      );
      const cards = page.locator('lib-community-posts lib-post');
      await expect(cards).toHaveCount(listRows.length, { timeout: 15_000 });
      expect(
        listRows.length,
        `${theme}: community result count`
      ).toBeGreaterThan(0);
      const renderedPost = cards.filter({ hasText: fixtureRow.title });
      await expect(renderedPost).toHaveCount(1);
      const subtitle = cards.locator('.subtitle').first();
      await expect(subtitle).toBeVisible();
      await capture(
        page,
        `localhub-post-subtitle-${theme}`,
        'lib-post .subtitle',
        'base'
      );
      await recordAxeContrast(
        page,
        `localhub-post-subtitle-${theme}`,
        'lib-post .subtitle'
      );
      const audience = page.locator('#postAudience');
      const audienceCount = await audience.count();
      const audienceVisible =
        audienceCount > 0 &&
        (await audience
          .first()
          .isVisible()
          .catch(() => false));
      record({
        type: 'cross-app-audience-presence',
        app: 'local-hub',
        route,
        theme,
        count: audienceCount,
        visible: audienceVisible,
        explanation: audienceVisible
          ? 'Rendered audience control independently measured below.'
          : 'Community page does not render the feed composer audience control.',
      });
      if (audienceVisible) {
        await capture(
          page,
          `localhub-post-audience-${theme}`,
          '#postAudience',
          'base'
        );
        await recordAxeContrast(
          page,
          `localhub-post-audience-${theme}`,
          '#postAudience'
        );
        const audienceKeyboardFocused = await focusByKeyboard(
          page,
          '#postAudience'
        );
        record({
          type: 'cross-app-compose-focus',
          app: 'local-hub',
          route,
          theme,
          reachedByTab: audienceKeyboardFocused,
        });
        expect(
          audienceKeyboardFocused,
          `${theme}: shared LocalHub compose audience control is keyboard reachable`
        ).toBe(true);
        if (audienceKeyboardFocused) {
          await capture(
            page,
            `localhub-post-audience-focus-${theme}`,
            '#postAudience',
            'keyboard-focus-visible'
          );
          await recordAxeContrast(
            page,
            `localhub-post-audience-focus-${theme}`,
            '#postAudience'
          );
        }
      }
      record({
        type: 'cross-app-community-posts',
        app: 'local-hub',
        route,
        theme,
        responsePostIds: listRows.map((row: { id: string }) => row.id),
        renderedCards: await cards.count(),
        subtitleCount: await cards.locator('.subtitle').count(),
        postsNavCount: 0,
        postsNavExplanation:
          'LocalHub CommunityComponent supplies showNavigation=false; posts-nav is intentionally not rendered.',
      });
    }
  } finally {
    if (
      (await page.locator('html').getAttribute('data-theme')) !== initialTheme
    ) {
      await operateTheme(page, initialTheme);
    }
    record({
      type: 'cross-app-restoration',
      app: 'local-hub',
      originalThemeRestored:
        (await page.locator('html').getAttribute('data-theme')) ===
        initialTheme,
      route: await page.evaluate(() => location.pathname),
    });
  }
});
