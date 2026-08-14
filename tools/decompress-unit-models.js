const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const registryPath = path.join(root, 'unit-assets.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const models = [...new Set(Object.values(registry.units).map(unit => unit.model))];
const replacements = new Map();

for (const relative of models) {
  if (relative.endsWith('-decoded.glb')) continue;
  if (!relative.endsWith('.glb')) continue;
  const input = path.join(root, relative.replace(/^\.\//, ''));
  const output = input.replace(/\.glb$/, '-decoded.glb');
  if (!fs.existsSync(output)) {
    const result = spawnSync('npx', ['--yes', '@gltf-transform/cli', 'copy', input, output], {
      cwd: root,
      stdio: 'inherit',
      shell: true
    });
    if (result.status !== 0) process.exit(result.status || 1);
  }
  if (fs.existsSync(input)) fs.unlinkSync(input);
  replacements.set(relative, `./${path.relative(root, output).replaceAll('\\', '/')}`);
}

for (const unit of Object.values(registry.units)) unit.model = replacements.get(unit.model) || unit.model;
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
console.log(`Decompressed ${replacements.size} unique models.`);
