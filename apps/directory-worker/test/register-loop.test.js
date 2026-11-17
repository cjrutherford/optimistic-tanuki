const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runRegisterLoop } = require('../src/register-loop');

test('resumes bootstrap, retries failures, then schedules repeated sweeps', async () => {
  const calls=[];
  const controller=new AbortController();
  let bootstrap=0, sweeps=0;
  await runRegisterLoop({
    signal:controller.signal,
    bootstrap:async()=>{ calls.push('bootstrap'); if (++bootstrap===1) throw Error('temporary'); return bootstrap===2?'more':'complete'; },
    sweep:async()=>{ calls.push('sweep'); return ++sweeps===1?'complete':'more'; },
    pause:async ms=>{ calls.push(ms); if (sweeps===2) controller.abort(); },
    retryMs:50, sweepIntervalMs:100,
  });
  assert.deepEqual(calls,['bootstrap',50,'bootstrap','bootstrap','sweep',100,'sweep',0]);
});

test('rejects invalid intervals before running pages', async()=>{
  await assert.rejects(runRegisterLoop({signal:new AbortController().signal,bootstrap:async()=>{ throw Error('unexpected'); },sweep:async()=>{ throw Error('unexpected'); },retryMs:0,sweepIntervalMs:100}),/interval/);
});
