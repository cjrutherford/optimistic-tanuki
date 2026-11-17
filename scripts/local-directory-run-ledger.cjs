/**
 * Acquisition run ledger for the local directory stage scripts (S7e).
 *
 * By default every stage invocation records a run: `beginRun`, one job per unit, progress with a checkpoint between
 * batches, and a cancel check. `--resume <runId>` consumes the pending resume/retry request an operator made in the
 * Owner Console and runs only the queued units. `--no-ledger` runs the stage without recording (nothing can then be
 * cancelled or resumed). Nothing here authorises or performs acquisition.
 */
const {
  beginJob,
  beginRun,
  classifyStageError,
  finishJob,
  finishRun,
  heartbeat,
  progress,
  resumeRunFromRequest,
  shouldStop,
} = require('../apps/directory/src/acquisition-run');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

class StageStopped extends Error {
  constructor() {
    super('Stopped at operator request');
    this.name = 'StageStopped';
  }
}

/** Split the ledger flags from a script's own arguments. */
function parseLedgerArgs(args) {
  const rest = [];
  let resume = null;
  let enabled = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--no-ledger') enabled = false;
    else if (args[i] === '--resume') {
      resume = args[++i];
      if (!UUID.test(resume || '')) throw Error('Invalid run');
    } else rest.push(args[i]);
  }
  if (resume && !enabled) throw Error('Invalid run');
  return { rest, resume, enabled };
}

/**
 * Open the ledger on the directory database. Returns an object whose methods are no-ops when disabled. When resuming,
 * `units` is the list of queued unit keys to run; otherwise it is null (run everything).
 */
async function openLedger(db, options) {
  const { enabled, resume, kind, provider, release, townIds, reason } = options;
  if (!enabled)
    return {
      id: null,
      units: null,
      job: async () => ({ attempt: 1, checkpoint: null }),
      progress: async () => false,
      heartbeat: async () => undefined,
      finishJob: async () => undefined,
      shouldStop: async () => false,
      finish: async () => undefined,
      fail: async () => undefined,
    };
  let id;
  let units = null;
  if (resume) {
    const resumed = await resumeRunFromRequest(db, resume);
    if (resumed.kind !== kind) throw Error('Invalid run');
    id = resumed.id;
    units = resumed.units;
  } else {
    id = await beginRun(db, { provider, release, kind, townIds, reason });
  }
  console.log(`Acquisition run ${id} ${resume ? 'resumed' : 'recorded'}.`);
  return {
    id,
    units,
    job: (unitKey, scope = {}) => beginJob(db, id, { unitKey, ...scope }),
    /** Returns true when the stage must stop. */
    progress: async (unitKey, counts) =>
      (await progress(db, id, unitKey, counts)).stop,
    /** Keeps a long, batch-less step (a remote scan) from looking dead; failures here never stop the stage. */
    heartbeat: () => heartbeat(db, id).catch(() => undefined),
    finishJob: (unitKey, input) => finishJob(db, id, unitKey, input),
    shouldStop: () => shouldStop(db, id),
    finish: (input) => finishRun(db, id, input),
    /** Record a failure of the current unit (if any) and of the run, with a redacted message. */
    fail: async (error, unitKey) => {
      const c = classifyStageError(error);
      if (unitKey)
        await finishJob(db, id, unitKey, {
          status: c.status,
          blockedReason: c.blockedReason,
          error,
        });
      await finishRun(db, id, {
        status: c.status,
        blockedReason: c.blockedReason,
        error,
      });
    },
  };
}

/**
 * Wrap a private sink so each committed batch is recorded (checkpoint and counts) and the cancel flag is checked between
 * batches. The batch is already durable when the check runs, so a resume continues from the sink's own checkpoint.
 */
function ledgerSink(sink, ledger, unitKey) {
  const counts = { observed: 0, accepted: 0, rejected: 0 };
  return new Proxy(sink, {
    get(target, name) {
      const value = target[name];
      if (typeof value !== 'function') return value;
      if (name !== 'commit') return value.bind(target);
      return async (rows, checkpoint) => {
        const out = await target.commit(rows, checkpoint);
        counts.observed += rows.length;
        for (const r of rows)
          counts[r.outcome?.status === 'eligible' ? 'accepted' : 'rejected']++;
        const stop = await ledger.progress(unitKey, {
          checkpoint: {
            scanId: checkpoint?.scanId ?? null,
            sourceFileRowNumber: checkpoint?.sourceFileRowNumber ?? null,
          },
          ...counts,
        });
        if (stop) throw new StageStopped();
        return out;
      };
    },
  });
}

module.exports = { StageStopped, ledgerSink, openLedger, parseLedgerArgs };
