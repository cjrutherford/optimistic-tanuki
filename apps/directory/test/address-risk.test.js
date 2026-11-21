const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyAddressRisk } = require('../src/address-risk');

test('clears an ordinary low-risk commercial address', () => {
  const result = classifyAddressRisk({
    name: 'Fixture Bakery',
    category: 'restaurant',
    address: '10 Main St',
  });
  assert.equal(result.residential, false);
  assert.equal(result.sensitive, false);
  assert.equal(result.adult, false);
  assert.deepEqual(result.reasons, []);
});

test('flags adult categories and text', () => {
  const result = classifyAddressRisk({
    name: 'Fixture Adult Entertainment',
    category: 'adult_entertainment_venue',
    address: '10 Main St',
  });
  assert.equal(result.adult, true);
  assert.ok(result.reasons.includes('adult_category_or_text'));
});

test('flags sensitive locations', () => {
  const result = classifyAddressRisk({
    name: 'Valdosta Women and Family Shelter',
    category: 'social_service',
    address: '10 Main St',
  });
  assert.equal(result.sensitive, true);
  assert.ok(result.reasons.includes('sensitive_category_or_text'));
});

test('sends unknown categories to a human', () => {
  const result = classifyAddressRisk({
    name: 'Fixture Church',
    category: 'christian_place_of_worship',
    address: '10 Main St',
  });
  assert.equal(result.residential, undefined);
  assert.equal(result.sensitive, false);
  assert.equal(result.adult, false);
  assert.ok(result.reasons.includes('category_requires_human_review'));
});

test('sends possible residential units to a human', () => {
  const result = classifyAddressRisk({
    name: 'Fixture Bakery',
    category: 'restaurant',
    address: '10 Main St Apt 3',
  });
  assert.equal(result.residential, undefined);
  assert.ok(result.reasons.includes('possible_residential_unit'));
});
