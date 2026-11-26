/**
 * Pure helpers for the image pull progress display.
 *
 * The Docker Engine streams newline-delimited JSON for POST /images/create.
 * Each layer reports progressDetail.current/total bytes while it downloads,
 * which is what these helpers aggregate into one bar per image.
 */

export function progressBar(percent, width = 18) {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'kB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const rounded = value >= 100 ? Math.round(value) : value.toFixed(1);
  return `${rounded} ${units[unit]}`;
}

export function shortName(ref) {
  let name = String(ref).split('@')[0];
  const slash = name.lastIndexOf('/');
  if (slash >= 0) {
    name = name.slice(slash + 1);
  }
  const colon = name.lastIndexOf(':');
  if (colon > 0) {
    name = name.slice(0, colon);
  }
  return name.replace(/^optimistic_tanuki_/, '');
}

export function createProgress(image, index, total) {
  return {
    image,
    index,
    total,
    layers: new Map(),
    error: null,
    upToDate: false,
    statusText: '',
    queued: 0,
    downloaded: 0,
    extracted: 0,
  };
}

export function applyMessage(state, message) {
  if (!message || typeof message !== 'object') {
    return;
  }
  if (message.error) {
    state.error = message.error;
    return;
  }
  if (typeof message.status === 'string' && message.status.trim()) {
    state.statusText = message.status.trim();
    if (message.status.toLowerCase().includes('image is up to date')) {
      state.upToDate = true;
    }
  }
  if (!message.id) {
    return;
  }

  let layer = state.layers.get(message.id);
  if (!layer) {
    layer = {
      current: 0,
      total: 0,
      queued: false,
      downloaded: false,
      extracted: false,
    };
    state.layers.set(message.id, layer);
  }

  if (message.status === 'Pulling fs layer' && !layer.queued) {
    layer.queued = true;
    state.queued += 1;
  }

  const detail = message.progressDetail;
  if (
    detail &&
    Number.isFinite(detail.current) &&
    Number.isFinite(detail.total) &&
    detail.total > 0
  ) {
    layer.current = detail.current;
    layer.total = detail.total;
  }

  if (message.status === 'Download complete') {
    if (layer.total > 0) {
      layer.current = layer.total;
    }
    if (!layer.downloaded) {
      layer.downloaded = true;
      state.downloaded += 1;
    }
  } else if (message.status === 'Pull complete') {
    if (layer.total > 0) {
      layer.current = layer.total;
    }
    if (!layer.extracted) {
      layer.extracted = true;
      state.extracted += 1;
    }
  }
}

export function summarize(state) {
  let current = 0;
  let total = 0;
  for (const layer of state.layers.values()) {
    if (layer.total > 0) {
      total += layer.total;
      current += Math.min(layer.current, layer.total);
    }
  }
  const percent = total > 0 ? Math.min(100, (current / total) * 100) : 0;
  return { current, total, percent };
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = (seconds % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

export function statusLine(state, maxPercent = 100, elapsedSeconds = 0) {
  const { current, total, percent: rawPercent } = summarize(state);
  const percent = Math.min(maxPercent, rawPercent);
  const counter = `[${state.index}/${state.total}]`.padEnd(9);
  const name = shortName(state.image).padEnd(18).slice(0, 18);
  const bar = progressBar(percent);
  const pct = `${Math.floor(percent).toString().padStart(3)}%`;
  const bytes = `${formatBytes(current)}/${formatBytes(total)}`;
  const elapsed = formatDuration(elapsedSeconds);
  return `${counter} ${bar} ${pct}  ${name}  ${bytes}  ${elapsed}`;
}

export function preparingLine(state, elapsedSeconds) {
  const counter = `[${state.index}/${state.total}]`.padEnd(9);
  const name = shortName(state.image).padEnd(18).slice(0, 18);
  const status = state.statusText || 'contacting registry';
  const layers =
    state.queued > 0
      ? `, ${state.queued} layer${state.queued === 1 ? '' : 's'}`
      : '';
  return `${counter} ${name}  ${status}${layers}  ${formatDuration(
    elapsedSeconds
  )}`;
}

export function overallLine(done, total, concurrency, elapsedSeconds) {
  const percent = total > 0 ? (done / total) * 100 : 0;
  const bar = progressBar(percent, 16);
  return `Pulling ${total} images (${concurrency} at a time)  ${bar} ${done}/${total}  ${formatDuration(
    elapsedSeconds
  )}`;
}
