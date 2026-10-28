interface Queryable {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
}
interface Database extends Queryable {
  transaction<T>(work: (manager: Queryable) => Promise<T>): Promise<T>;
}
export interface ActivityRetentionRule {
  table: string;
  timeColumn: string;
  timestampWithZone: boolean;
}
export interface ActivityRetentionReport {
  owner: string;
  cutoff: string;
  state: 'verified' | 'pending' | 'blocked';
  sources: {
    source: string;
    deleted: number;
    remaining: number | null;
    state: 'verified' | 'pending' | 'blocked';
  }[];
}
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_]{0,62}$/;
const quote = (name: string) => {
  if (!IDENTIFIER.test(name)) throw Error('RETENTION_IDENTIFIER_INVALID');
  return `"${name}"`;
};
function timestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 64 &&
    Number.isFinite(Date.parse(value))
  );
}
function count(value: unknown): number {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    !/^\d+$/.test(String(value[0]?.remaining))
  )
    throw Error('RETENTION_READBACK_INVALID');
  const n = Number(value[0].remaining);
  if (!Number.isSafeInteger(n) || n < 0)
    throw Error('RETENTION_READBACK_INVALID');
  return n;
}
export function activityRetentionRule(
  metadata: {
    tableName: string;
    findColumnWithPropertyName(
      name: string
    ): { databaseName: string; type: unknown } | undefined;
  },
  property = 'createdAt'
): ActivityRetentionRule {
  const column = metadata.findColumnWithPropertyName(property);
  if (!column) throw Error('RETENTION_TIMESTAMP_MISSING');
  const withZone = ['timestamptz', 'timestamp with time zone'].includes(
    String(column.type)
  );
  if (
    !withZone &&
    column.type !== Date &&
    !['timestamp', 'timestamp without time zone'].includes(String(column.type))
  )
    throw Error('RETENTION_TIMESTAMP_UNSUPPORTED');
  quote(metadata.tableName);
  quote(column.databaseName);
  return {
    table: metadata.tableName,
    timeColumn: column.databaseName,
    timestampWithZone: withZone,
  };
}
/** Internal age-only deletion. It cannot override permanent account fences or restore rows. */
export class ActivityRetentionService {
  private timer?: ReturnType<typeof setTimeout>;
  private closed = false;
  private active?: Promise<ActivityRetentionReport>;
  private last?: ActivityRetentionReport;
  constructor(
    readonly owner: string,
    private readonly database: Database,
    private readonly rules: readonly ActivityRetentionRule[]
  ) {
    if (
      !['authentication', 'profile', 'assets', 'social', 'forum'].includes(
        owner
      ) ||
      !rules.length ||
      rules.length > 12 ||
      new Set(rules.map((v) => v.table)).size !== rules.length
    )
      throw Error('RETENTION_POLICY_INVALID');
    for (const rule of rules) {
      quote(rule.table);
      quote(rule.timeColumn);
      if (typeof rule.timestampWithZone !== 'boolean')
        throw Error('RETENTION_POLICY_INVALID');
    }
  }
  onModuleInit() {
    void this.tick();
  }
  async onModuleDestroy() {
    this.closed = true;
    clearTimeout(this.timer);
    await this.active?.catch(() => undefined);
  }
  private async transaction<T>(
    work: (manager: Queryable) => Promise<T>
  ): Promise<T> {
    return this.database.transaction(async (manager) => {
      await manager.query("SET LOCAL statement_timeout='5s'");
      await manager.query("SET LOCAL lock_timeout='1s'");
      return work(manager);
    });
  }
  private expression(rule: ActivityRetentionRule) {
    return rule.timestampWithZone
      ? '$1::timestamptz'
      : "($1::timestamptz AT TIME ZONE 'UTC')";
  }
  private async cutoff(override?: string): Promise<string> {
    const rows = await this.transaction((m) =>
      m.query("SELECT (clock_timestamp()-interval '90 days')::text AS cutoff")
    );
    if (
      !Array.isArray(rows) ||
      rows.length !== 1 ||
      !timestamp(rows[0]?.cutoff)
    )
      throw Error('RETENTION_CLOCK_UNAVAILABLE');
    const cutoff = rows[0].cutoff as string;
    if (
      override !== undefined &&
      (!timestamp(override) || Date.parse(override) > Date.parse(cutoff))
    )
      throw Error('RETENTION_CUTOFF_INVALID');
    return override ?? cutoff;
  }
  async readback(): Promise<ActivityRetentionReport> {
    const cutoff = await this.cutoff();
    const sources: ActivityRetentionReport['sources'] = [];
    for (const rule of this.rules) {
      let remaining: number | null = null;
      try {
        remaining = count(
          await this.transaction((m) =>
            m.query(
              `SELECT count(*)::text AS remaining FROM ${quote(
                rule.table
              )} WHERE ${quote(rule.timeColumn)}<=${this.expression(rule)}`,
              [cutoff]
            )
          )
        );
      } catch {
        /* Unknown is blocked, never zero. */
      }
      sources.push({
        source: rule.table,
        deleted: 0,
        remaining,
        state:
          remaining === null
            ? 'blocked'
            : remaining > 0
            ? 'pending'
            : 'verified',
      });
    }
    return {
      owner: this.owner,
      cutoff,
      state: sources.some((v) => v.state === 'blocked')
        ? 'blocked'
        : sources.some((v) => v.state === 'pending')
        ? 'pending'
        : 'verified',
      sources,
    };
  }
  sweep(override?: string): Promise<ActivityRetentionReport> {
    if (this.closed) return Promise.reject(Error('RETENTION_CLOSED'));
    if (this.active) return this.active;
    const pending = this.run(override).finally(() => {
      if (this.active === pending) this.active = undefined;
    });
    this.active = pending;
    return pending;
  }
  private async run(override?: string): Promise<ActivityRetentionReport> {
    const cutoff = await this.cutoff(override);
    const sources: ActivityRetentionReport['sources'] = [];
    for (const rule of this.rules) {
      let deleted = 0,
        failed = false,
        remaining: number | null = null;
      try {
        const rows = await this.transaction((m) =>
          m.query(
            `WITH due AS (SELECT "id" FROM ${quote(rule.table)} WHERE ${quote(
              rule.timeColumn
            )}<=${this.expression(rule)} ORDER BY ${quote(
              rule.timeColumn
            )},"id" LIMIT 200 FOR UPDATE SKIP LOCKED) DELETE FROM ${quote(
              rule.table
            )} t USING due WHERE t."id"=due."id" RETURNING t."id"`,
            [cutoff]
          )
        );
        if (
          !Array.isArray(rows) ||
          rows.length !== 2 ||
          !Array.isArray(rows[0]) ||
          !Number.isSafeInteger(rows[1]) ||
          rows[1] !== rows[0].length ||
          rows[1] > 200
        )
          throw Error('RETENTION_DELETE_UNVERIFIED');
        deleted = rows[1];
      } catch {
        failed = true;
      }
      try {
        remaining = count(
          await this.transaction((m) =>
            m.query(
              `SELECT count(*)::text AS remaining FROM ${quote(
                rule.table
              )} WHERE ${quote(rule.timeColumn)}<=${this.expression(rule)}`,
              [cutoff]
            )
          )
        );
      } catch {
        failed = true;
      }
      sources.push({
        source: rule.table,
        deleted,
        remaining,
        state:
          failed || remaining === null
            ? 'blocked'
            : remaining > 0
            ? 'pending'
            : 'verified',
      });
    }
    const report: ActivityRetentionReport = {
      owner: this.owner,
      cutoff,
      state: sources.some((v) => v.state === 'blocked')
        ? 'blocked'
        : sources.some((v) => v.state === 'pending')
        ? 'pending'
        : 'verified',
      sources,
    };
    this.last = report;
    return report;
  }
  private async tick() {
    if (this.closed) return;
    try {
      await this.sweep();
    } catch {
      this.last = undefined;
    }
    if (this.closed) return;
    this.timer = setTimeout(
      () => void this.tick(),
      this.last?.state === 'pending'
        ? 1000
        : this.last?.state === 'verified'
        ? 60000
        : 5000
    );
    this.timer.unref?.();
  }
}
