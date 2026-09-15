// Pairwise distinctiveness of personalities from captured computed styles.
const fs = require('fs');
const ROOT = process.env.DESIGN_REVIEW_OUT || '/tmp/persona-eval';
const PERS = [
  'classic',
  'minimal',
  'bold',
  'soft',
  'professional',
  'playful',
  'elegant',
  'architect',
  'soft-touch',
  'electric',
  'control-center',
  'foundation',
];
const norm = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
const fam = (v) => norm(v).split(',')[0].replace(/["']/g, '').toLowerCase();

for (const mode of ['light', 'dark']) {
  const file = `${ROOT}/signatures-${mode}.jsonl`;
  if (!fs.existsSync(file)) continue;
  const rows = fs
    .readFileSync(file, 'utf8')
    .trim()
    .split('\n')
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  // Merge button-row story (button) and form story (input/label) per personality.
  const sig = {};
  for (const r of rows) {
    const s = (sig[r.personality] ||= {});
    let d = r.sig || {};
    if (typeof d === 'string') {
      try {
        d = JSON.parse(d);
      } catch {
        d = {};
      }
    }
    if (r.story.startsWith('common-ui') && d.button) s.button = d.button;
    if (r.story.startsWith('form-ui')) {
      if (d.input) s.input = d.input;
      if (d.label) s.label = d.label;
      if (d.card) s.card = d.card;
    }
  }
  const features = (s) => {
    const b = s.button || {},
      i = s.input || {},
      l = s.label || {},
      c = s.card || {};
    return {
      'btn radius': norm(b.borderRadius),
      'btn border': `${norm(b.borderTopWidth)} ${norm(b.borderTopStyle)}`,
      'btn shadow': norm(b.boxShadow).replace(/rgba?\([^)]*\)/g, 'c'),
      'btn font': fam(b.fontFamily),
      'btn weight': norm(b.fontWeight),
      'btn case': norm(b.textTransform),
      'btn tracking': norm(b.letterSpacing),
      'btn fill':
        norm(b.backgroundImage) !== 'none'
          ? norm(b.backgroundImage).split('(')[0]
          : 'flat',
      'btn height': norm(b.height),
      'btn padX': norm(b.paddingLeft),
      'input radius': norm(i.borderRadius),
      'input border': `${norm(i.borderTopWidth)} ${norm(i.borderTopStyle)}`,
      'input shadow': norm(i.boxShadow).replace(/rgba?\([^)]*\)/g, 'c'),
      'input font': fam(i.fontFamily),
      'label font': fam(l.fontFamily),
      'label case': norm(l.textTransform),
      'label weight': norm(l.fontWeight),
      'card radius': norm(c.borderRadius),
      'card shadow': norm(c.boxShadow).replace(/rgba?\([^)]*\)/g, 'c'),
    };
  };
  const F = Object.fromEntries(
    PERS.filter((p) => sig[p]).map((p) => [p, features(sig[p])])
  );
  console.log(`\n=== ${mode}: per-personality signature ===`);
  for (const [p, f] of Object.entries(F))
    console.log(
      p.padEnd(15),
      `radius ${f['btn radius']}/${f['input radius']}/${f['card radius']} | border ${f['btn border']} | font ${f['btn font']} ${f['btn weight']} ${f['btn case']} ${f['btn tracking']} | fill ${f['btn fill']} | h ${f['btn height']} | label ${f['label font']} ${f['label case']}`
    );
  const keys = Object.keys(Object.values(F)[0] || {});
  const pairs = [];
  const names = Object.keys(F);
  for (let a = 0; a < names.length; a++)
    for (let b = a + 1; b < names.length; b++) {
      const diff = keys.filter((k) => F[names[a]][k] !== F[names[b]][k]);
      pairs.push({
        pair: `${names[a]} ~ ${names[b]}`,
        diffCount: diff.length,
        diff,
      });
    }
  pairs.sort((x, y) => x.diffCount - y.diffCount);
  console.log(`\n=== ${mode}: closest pairs (of ${keys.length} features) ===`);
  for (const p of pairs.slice(0, 12))
    console.log(
      String(p.diffCount).padStart(2),
      p.pair.padEnd(34),
      'differs in:',
      p.diff.join(', ') || '(identical)'
    );
  const featureSpread = keys
    .map((k) => [k, new Set(Object.values(F).map((f) => f[k])).size])
    .sort((x, y) => x[1] - y[1]);
  console.log(
    `\n=== ${mode}: distinct values per feature (12 = every personality differs) ===`
  );
  console.log(featureSpread.map(([k, n]) => `${k}:${n}`).join('  '));
}
