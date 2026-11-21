const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/** Minimal draft-07 validator for the subset export-schema.json uses. Returns a list of error strings. */
const schema = JSON.parse(
  readFileSync(join(__dirname, '../src/export-schema.json'), 'utf8')
);
const typeOf = (v) =>
  v === null
    ? 'null'
    : Array.isArray(v)
    ? 'array'
    : Number.isInteger(v)
    ? 'integer'
    : typeof v;
function check(s, v, path, errors) {
  if (s.$ref) {
    const target = s.$ref
      .replace('#/', '')
      .split('/')
      .reduce((o, k) => o[k], schema);
    return check(target, v, path, errors);
  }
  if (s.oneOf) {
    const hits = s.oneOf.filter((alt) => {
      const e = [];
      check(alt, v, path, e);
      return !e.length;
    });
    if (hits.length !== 1) errors.push(`${path}: oneOf matched ${hits.length}`);
    return errors;
  }
  if ('const' in s && v !== s.const) errors.push(`${path}: const`);
  if (s.enum && !s.enum.includes(v)) errors.push(`${path}: enum`);
  if (s.type) {
    const t = typeOf(v);
    if (!(t === s.type || (s.type === 'number' && t === 'integer')))
      return errors.push(`${path}: type ${t}`), errors;
  }
  if (typeof v === 'string') {
    if (s.minLength && v.length < s.minLength)
      errors.push(`${path}: minLength`);
    if (s.pattern && !new RegExp(s.pattern).test(v))
      errors.push(`${path}: pattern`);
  }
  if (typeof v === 'number' && s.minimum !== undefined && v < s.minimum)
    errors.push(`${path}: minimum`);
  if (Array.isArray(v) && s.items)
    v.forEach((x, i) => check(s.items, x, `${path}/${i}`, errors));
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const k of s.required || [])
      if (!(k in v)) errors.push(`${path}: missing ${k}`);
    for (const k of Object.keys(v)) {
      if (s.properties && k in s.properties)
        check(s.properties[k], v[k], `${path}/${k}`, errors);
      else if (s.additionalProperties === false)
        errors.push(`${path}: unexpected ${k}`);
    }
  }
  return errors;
}
module.exports = { validateLine: (v) => check(schema, v, '', []) };
