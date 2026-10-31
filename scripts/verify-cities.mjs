#!/usr/bin/env node
/**
 * Verifies src/data/cities.json.
 *
 * (a) JSON.parse succeeds
 * (b) length is 260..300
 * (c) ids are unique, exactly 7 keys per entry, all keys non-empty
 * (d) every zone is a real IANA zone contained in Intl.supportedValuesOf('timeZone')
 *
 * Modern tzdata (2022+) renamed several zones: Asia/Kolkata (was Calcutta),
 * Asia/Kathmandu (was Katmandu), Asia/Yangon (was Rangoon), Asia/Ho_Chi_Minh
 * (was Saigon), Europe/Kyiv (was Kiev), Atlantic/Faroe (was Faeroe),
 * America/Nuuk (was Godthab). Some ICU builds still enumerate only the legacy
 * ids from supportedValuesOf() while accepting and canonicalizing the modern
 * name. A zone therefore passes when it is listed literally, or when Intl
 * fully canonicalizes it (without falling back to UTC) to a listed id.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? resolve(here, '../src/data/cities.json');

const KEYS = ['id', 'en', 'zh', 'countryEn', 'countryZh', 'zone', 'popular'];
const POPULAR = ['tokyo', 'shanghai', 'beijing', 'hong-kong', 'singapore', 'seoul', 'london', 'paris', 'berlin', 'new-york', 'los-angeles', 'san-francisco', 'sydney', 'dubai'];

const failures = [];
const fail = (msg) => failures.push(msg);

// (a) parse + BOM check
const bytes = readFileSync(file);
if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) fail('file starts with a UTF-8 BOM');
const text = bytes.toString('utf8');
let data;
try {
  data = JSON.parse(text);
} catch (err) {
  console.error('FATAL: JSON.parse failed:', err.message);
  process.exit(1);
}
if (!Array.isArray(data)) {
  console.error('FATAL: top-level value is not an array');
  process.exit(1);
}

// (b) length
if (!Number.isInteger(data.length) || data.length < 260 || data.length > 300) {
  fail(`length ${data.length} is outside 260..300`);
}

// (c) shape, unique ids, non-empty keys, sorting, popular set
const supported = new Set(Intl.supportedValuesOf('timeZone'));
const seenIds = new Set();
const popularIds = [];
const aliasZones = [];

function checkZone(zone, where) {
  if (typeof zone !== 'string' || zone.trim() === '') {
    fail(`${where}: "zone" is not a non-empty string`);
    return;
  }
  let canonical;
  try {
    canonical = new Intl.DateTimeFormat('en-US', { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    fail(`${where}: "${zone}" is rejected by Intl.DateTimeFormat`);
    return;
  }
  if (supported.has(zone)) return;
  // Modern rename still accepted by this ICU: canonicalizes to the legacy id.
  if (canonical && canonical !== 'UTC' && supported.has(canonical)) {
    aliasZones.push(`${zone} -> ${canonical}`);
    return;
  }
  fail(`${where}: "${zone}" (canonical "${canonical}") is not in Intl.supportedValuesOf('timeZone')`);
}

data.forEach((city, i) => {
  const where = `[${i}] ${city?.id ?? '(no id)'}`;
  if (!city || typeof city !== 'object' || Array.isArray(city)) return fail(`${where}: entry is not an object`);
  const keys = Object.keys(city);
  if (keys.length !== KEYS.length) fail(`${where}: has ${keys.length} keys, expected ${KEYS.length} (${keys.join(',')})`);
  for (const k of KEYS) if (!(k in city)) fail(`${where}: missing key "${k}"`);
  for (const k of keys) if (!KEYS.includes(k)) fail(`${where}: unexpected key "${k}"`);

  for (const k of KEYS) {
    if (k === 'popular') continue;
    const v = city[k];
    if (typeof v !== 'string' || v.trim() === '') fail(`${where}: "${k}" is not a non-empty string`);
  }
  if (city.zh && !/[\u4e00-\u9fff]/.test(city.zh)) fail(`${where}: "zh" has no Chinese characters: ${city.zh}`);
  if (city.countryZh && !/[\u4e00-\u9fff]/.test(city.countryZh)) fail(`${where}: "countryZh" has no Chinese characters: ${city.countryZh}`);
  if (city.id && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(city.id)) fail(`${where}: id is not a lowercase ASCII slug`);
  if (typeof city.popular !== 'boolean') fail(`${where}: "popular" is not a boolean`);

  if (seenIds.has(city.id)) fail(`${where}: duplicate id`);
  seenIds.add(city.id);
  if (city.popular === true) popularIds.push(city.id);

  checkZone(city.zone, where);
});

for (let i = 1; i < data.length; i += 1) {
  const prev = data[i - 1]?.en;
  const cur = data[i]?.en;
  if (typeof prev === 'string' && typeof cur === 'string' && prev.localeCompare(cur, 'en') > 0) {
    fail(`sorting: "${prev}" appears before "${cur}" at index ${i}`);
  }
}

const popularSet = new Set(popularIds);
if (popularSet.size !== popularIds.length) fail('duplicate ids in the popular set');
for (const id of POPULAR) if (!popularSet.has(id)) fail(`popular: required id "${id}" is not popular:true`);
for (const id of popularSet) if (!POPULAR.includes(id)) fail(`popular: "${id}" is popular:true but is not in the required list`);
if (popularIds.length !== POPULAR.length) fail(`popular: ${popularIds.length} popular entries, expected ${POPULAR.length}`);

const unknownIds = [...popularSet].filter((id) => !seenIds.has(id));

if (failures.length) {
  console.error(`\nFAILED with ${failures.length} problem(s):\n`);
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}

console.log('checks passed');
console.log('  file        :', file);
console.log('  bytes       :', bytes.length, '(no BOM)');
console.log('  count       :', data.length, '(260-300 ok)');
console.log('  unique ids  :', seenIds.size);
console.log('  popular     :', popularIds.length, '->', [...POPULAR].join(', '));
console.log('  zones valid :', data.length, '/', data.length);
console.log('  alias zones :', aliasZones.length, [...new Set(aliasZones)].join(', ') || '(none)');
console.log('  missing pop :', unknownIds.length);
