const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const inventory = JSON.parse(fs.readFileSync(path.join(root, 'apartments.json'), 'utf8'));
const outRoot = path.join(root, 'unit-assets');
const modelRoot = path.join(outRoot, 'models');
const textureRoot = path.join(outRoot, 'textures');
fs.mkdirSync(modelRoot, { recursive: true });
fs.mkdirSync(textureRoot, { recursive: true });

const decode = value => value
  .replaceAll('&quot;', '"')
  .replaceAll('&#039;', "'")
  .replaceAll('&amp;', '&');

function attribute(html, name) {
  const match = html.match(new RegExp(`${name}="([^"]+)"`));
  if (!match) return [];
  try { return JSON.parse(decode(match[1])); } catch { return []; }
}

function sourceUrl(value) {
  const url = new URL(decode(value));
  return url.hostname === 'wsrv.nl' && url.searchParams.get('url')
    ? url.searchParams.get('url')
    : url.href;
}

function localName(url) {
  const parsed = new URL(url);
  const base = path.basename(parsed.pathname) || 'asset.bin';
  return `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 10)}-${base}`;
}

async function download(url, folder) {
  const source = sourceUrl(url);
  const name = localName(source);
  const target = path.join(folder, name);
  if (!fs.existsSync(target)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`${response.status} ${source}`);
    fs.writeFileSync(target, Buffer.from(await response.arrayBuffer()));
  }
  return `./unit-assets/${path.basename(folder)}/${name}`;
}

async function inspect(unit) {
  const response = await fetch(unit.url, { redirect: 'follow' });
  const html = await response.text();
  const redirected = response.url.replace(/\/$/, '') !== unit.url.replace(/\/$/, '');
  const model = (html.match(/data-model-url="([^"]+)"/) || [])[1] || null;
  return {
    unit,
    redirected,
    model,
    textures: attribute(html, 'data-model-textures'),
    houseTextures: attribute(html, 'data-house-apartment-textures')
  };
}

async function pooled(items, worker, concurrency = 10) {
  const result = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return result;
}

(async () => {
  const candidates = inventory.filter(unit => unit.status !== 'sold');
  const pages = await pooled(candidates, inspect, 12);
  const registry = {};

  await pooled(pages.filter(page => page.model && !page.redirected), async page => {
    const model = await download(page.model, modelRoot);
    const textures = await pooled(page.textures, url => download(url, textureRoot), 6);
    const houseTextures = await pooled(page.houseTextures, url => download(url, textureRoot), 4);
    registry[String(page.unit.number_num)] = {
      model,
      textures,
      environment: houseTextures[0] || null,
      auxiliary: houseTextures.slice(1),
      format: textures.length === 1 ? 'atlas' : 'materials',
      source: page.unit.url
    };
  }, 6);

  const exactUnits = new Set(Object.keys(registry));
  for (const page of pages) {
    const number = String(page.unit.number_num);
    if (registry[number] || page.redirected) continue;
    const sameTower = candidates
      .filter(unit => exactUnits.has(String(unit.number_num)) && unit.house?.identificator === page.unit.house?.identificator)
      .sort((a, b) => Math.abs(+a.min_floor - +page.unit.min_floor) - Math.abs(+b.min_floor - +page.unit.min_floor));
    const fallback = sameTower[0];
    if (fallback) registry[number] = { ...registry[String(fallback.number_num)], fallbackFrom: String(fallback.number_num) };
  }

  const disabled = inventory
    .filter(unit => unit.status === 'sold' || pages.some(page => page.redirected && page.unit.id === unit.id))
    .map(unit => String(unit.number_num));

  fs.writeFileSync(path.join(root, 'unit-assets.json'), JSON.stringify({ units: registry, disabled }, null, 2) + '\n');
  console.log(`Synced ${Object.keys(registry).length} unit entries; disabled ${disabled.length}.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
