import {
  DUPLICATE_ACTIONS,
  DUPLICATE_PAGE_MAX,
  DUPLICATE_RULES,
  DUPLICATE_STATES,
  DUPLICATE_STATUSES,
  type DuplicateListQuery,
} from './duplicate-review';
import { SAMPLE_MAX_SIZE, SAMPLE_VERDICTS } from './duplicate-sample';

/**
 * Routing and body validation for the internal duplicate-review endpoints (reviewer-only, reached by the gateway
 * with the local-evaluation secret). Pure so the surface can be tested without a server.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const ROUND = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const SEED = /^[A-Za-z0-9._-]{1,64}$/;
export const DUPLICATE_PATH =
  /^\/internal\/local-evaluation\/towns\/([0-9a-f-]{36})\/duplicate-cases((?:\/[A-Za-z0-9-]+){0,3})$/;

export type DuplicateRoute =
  | { kind: 'list'; townId: string; query: DuplicateListQuery }
  | { kind: 'detail'; townId: string; caseId: string }
  | { kind: 'decide'; townId: string; caseId: string }
  | { kind: 'samples'; townId: string }
  | { kind: 'sample-draw'; townId: string }
  | { kind: 'sample'; townId: string; sampleId: string }
  | { kind: 'sample-judge'; townId: string; sampleId: string };

/** Returns null when the path or method is not a duplicate-review route (the caller answers 404 or falls through). */
export function parseDuplicateRoute(
  method: string,
  pathname: string,
  search: string
): DuplicateRoute | null {
  const m = DUPLICATE_PATH.exec(pathname);
  if (!m) return null;
  const townId = m[1];
  const parts = m[2].split('/').filter(Boolean);
  const get = method === 'GET';
  const post = method === 'POST';
  if (!parts.length && get) return { kind: 'list', townId, query: {} };
  if (search && !(parts.length === 0 && get)) return null;
  if (parts[0] === 'samples') {
    if (parts.length === 1) {
      if (get) return { kind: 'samples', townId };
      if (post) return { kind: 'sample-draw', townId };
    }
    if (parts.length === 2 && get && UUID.test(parts[1]))
      return { kind: 'sample', townId, sampleId: parts[1] };
    if (
      parts.length === 3 &&
      post &&
      parts[2] === 'judge' &&
      UUID.test(parts[1])
    )
      return { kind: 'sample-judge', townId, sampleId: parts[1] };
    return null;
  }
  if (!UUID.test(parts[0] ?? '')) return null;
  if (parts.length === 1 && get)
    return { kind: 'detail', townId, caseId: parts[0] };
  if (parts.length === 2 && post && parts[1] === 'decide')
    return { kind: 'decide', townId, caseId: parts[0] };
  return null;
}

/** Strict query parsing: only known keys, no repeats, bounded integers. Returns null when anything is off. */
export function parseListQuery(search: string): DuplicateListQuery | null {
  const params = new URLSearchParams(search);
  const out: {
    state?: string;
    status?: string;
    rule?: string;
    limit?: number;
    offset?: number;
  } = {};
  const seen = new Set<string>();
  for (const [key, value] of params) {
    if (seen.has(key)) return null;
    seen.add(key);
    if (key === 'state') {
      if (!DUPLICATE_STATES.includes(value)) return null;
      out.state = value;
    } else if (key === 'status') {
      if (!DUPLICATE_STATUSES.includes(value)) return null;
      out.status = value;
    } else if (key === 'rule') {
      if (!DUPLICATE_RULES.includes(value)) return null;
      out.rule = value;
    } else if (key === 'limit') {
      if (!/^[0-9]{1,3}$/.test(value)) return null;
      const n = Number(value);
      if (n < 1 || n > DUPLICATE_PAGE_MAX) return null;
      out.limit = n;
    } else if (key === 'offset') {
      if (!/^[0-9]{1,8}$/.test(value)) return null;
      out.offset = Number(value);
    } else return null;
  }
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const only = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).every((k) => keys.includes(k));

export interface DecideBody {
  action: string;
  reason: string;
  actorId: string;
  expectedState?: string;
  expectedKept?: { scanId: string; sourceFileRowNumber: string };
}
export function parseDecideBody(v: unknown): DecideBody | null {
  if (
    !isObject(v) ||
    !only(v, [
      'action',
      'reason',
      'actorId',
      'expectedState',
      'expectedKept',
    ]) ||
    typeof v['actorId'] !== 'string' ||
    !UUID.test(v['actorId']) ||
    typeof v['action'] !== 'string' ||
    !(DUPLICATE_ACTIONS as readonly string[]).includes(v['action']) ||
    typeof v['reason'] !== 'string' ||
    !v['reason'].trim() ||
    v['reason'].length > 1024 ||
    (v['expectedState'] !== undefined &&
      (typeof v['expectedState'] !== 'string' ||
        !DUPLICATE_STATES.includes(v['expectedState']))) ||
    (v['expectedKept'] !== undefined &&
      !(
        isObject(v['expectedKept']) &&
        only(v['expectedKept'], ['scanId', 'sourceFileRowNumber']) &&
        typeof v['expectedKept']['scanId'] === 'string' &&
        v['expectedKept']['scanId'].length <= 64 &&
        typeof v['expectedKept']['sourceFileRowNumber'] === 'string' &&
        /^[0-9]{1,18}$/.test(v['expectedKept']['sourceFileRowNumber'])
      ))
  )
    return null;
  return v as unknown as DecideBody;
}

export interface DrawBody {
  round: string;
  actorId: string;
  size?: number;
  seed?: string;
}
export function parseDrawBody(v: unknown): DrawBody | null {
  if (
    !isObject(v) ||
    !only(v, ['round', 'actorId', 'size', 'seed']) ||
    typeof v['actorId'] !== 'string' ||
    !UUID.test(v['actorId']) ||
    typeof v['round'] !== 'string' ||
    !ROUND.test(v['round']) ||
    (v['size'] !== undefined &&
      (!Number.isInteger(v['size']) ||
        (v['size'] as number) < 1 ||
        (v['size'] as number) > SAMPLE_MAX_SIZE)) ||
    (v['seed'] !== undefined &&
      (typeof v['seed'] !== 'string' || !SEED.test(v['seed'])))
  )
    return null;
  return v as unknown as DrawBody;
}

export interface JudgeBody {
  caseId: string;
  verdict: string;
  actorId: string;
}
export function parseJudgeBody(v: unknown): JudgeBody | null {
  if (
    !isObject(v) ||
    !only(v, ['caseId', 'verdict', 'actorId']) ||
    typeof v['actorId'] !== 'string' ||
    !UUID.test(v['actorId']) ||
    typeof v['caseId'] !== 'string' ||
    !UUID.test(v['caseId']) ||
    typeof v['verdict'] !== 'string' ||
    !(SAMPLE_VERDICTS as readonly string[]).includes(v['verdict'])
  )
    return null;
  return v as unknown as JudgeBody;
}
