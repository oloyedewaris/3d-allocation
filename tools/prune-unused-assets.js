const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'unit-assets.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const apply = process.argv.includes('--apply');
const disabled = new Set(registry.disabled.map(String));
const keep = new Set();

function materialKey(name) {
  return name.toLowerCase().replace(/_collide|\.\d+|[-_]\d+$/g, '').replace(/[^a-z0-9]/g, '');
}

function meshKeys(modelPath) {
  const buffer = fs.readFileSync(modelPath);
  if (buffer.toString('ascii', 0, 4) !== 'glTF') return null;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4);
    if (type === 0x4e4f534a) {
      const gltf = JSON.parse(buffer.toString('utf8', offset + 8, offset + 8 + length).replace(/\0+$/, ''));
      return new Set((gltf.nodes || []).filter((node) => node.mesh !== undefined).map((node) => materialKey(node.name || '')));
    }
    offset += 8 + length;
  }
  return null;
}

const modelKeys = new Map();

function localPath(value) {
  if (typeof value !== 'string' || !value.startsWith('./')) return null;
  return path.resolve(root, value.slice(2));
}

for (const [number, asset] of Object.entries(registry.units)) {
  if (disabled.has(number)) continue;
  let textures = asset.textures || [];
  if (asset.format !== 'atlas') {
    const model = localPath(asset.model);
    if (model && !modelKeys.has(model)) modelKeys.set(model, meshKeys(model));
    const keys = modelKeys.get(model);
    if (keys) textures = textures.filter((value) => {
      const basename = path.basename(value).replace(/^[0-9a-f]{10}-/, '').replace(/\.[^.]+$/, '');
      return keys.has(materialKey(basename));
    });
    if (apply) asset.textures = textures;
  } else if (textures.length > 1) {
    textures = textures.slice(0, 1);
    if (apply) asset.textures = textures;
  }
  [asset.model, asset.environment, ...textures].forEach((value) => {
    const file = localPath(value);
    if (file) keep.add(file.toLowerCase());
  });
}

const assetRoot = path.join(root, 'unit-assets');
const files = fs.readdirSync(assetRoot, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath || entry.path, entry.name));
const unused = files.filter((file) => !keep.has(file.toLowerCase()));
const bytes = unused.reduce((sum, file) => sum + fs.statSync(file).size, 0);

const groups = new Map();
for (const file of unused) {
  const ext = path.extname(file).toLowerCase() || '(none)';
  const current = groups.get(ext) || { count: 0, bytes: 0 };
  current.count += 1;
  current.bytes += fs.statSync(file).size;
  groups.set(ext, current);
}

console.log(`${apply ? 'Removing' : 'Would remove'} ${unused.length} unused unit assets (${(bytes / 1048576).toFixed(2)} MB)`);
for (const [ext, data] of groups) console.log(`  ${ext}: ${data.count} files, ${(data.bytes / 1048576).toFixed(2)} MB`);

if (apply) {
  for (const file of unused) fs.unlinkSync(file);
  for (const number of disabled) delete registry.units[number];
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
  console.log(`Removed disabled unit records; ${Object.keys(registry.units).length} enabled records remain.`);
}
