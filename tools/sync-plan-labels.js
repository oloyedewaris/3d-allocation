const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const apartments = JSON.parse(fs.readFileSync(path.join(root, 'apartments.json'), 'utf8'));
const floors = [...new Set(apartments.map((unit) => Number(unit.min_floor || unit.floor)))].sort((a, b) => a - b);

function extractLabels(html, floor) {
  const marker = new RegExp(`<g[^>]+id=["']_${floor}[^"']*_labels["'][^>]*>`, 'i');
  const start = html.search(marker);
  if (start < 0) return null;

  const before = html.slice(0, start);
  const viewBoxes = [...before.matchAll(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/gi)];
  const viewBox = viewBoxes.at(-1)?.slice(1).map(Number);
  if (!viewBox) return null;

  const section = html.slice(start, html.indexOf('</svg>', start));
  const labels = [];
  const groupPattern = /<g\b([^>]*\bdata-name=["']([^"']+)["'][^>]*)>([\s\S]{0,1200}?<rect\s+[^>]+>)/gi;
  for (const match of section.matchAll(groupPattern)) {
    const groupAttr = match[1];
    const attr = match[3].match(/<rect\s+([^>]+)>/i)?.[1] || '';
    const value = (name) => Number(attr.match(new RegExp(`${name}=["']([\\d.-]+)["']`, 'i'))?.[1]);
    const [x, y, width, height] = ['x', 'y', 'width', 'height'].map(value);
    const className = groupAttr.match(/class=["']([^"']*)["']/i)?.[1] || '';
    if ([x, y, width, height].every(Number.isFinite)) labels.push({ unit: match[2], className, x, y, width, height });
  }
  return labels.length ? { viewBox, labels } : null;
}

async function main() {
  const result = {};
  for (const floor of floors) {
    result[floor] = {};
    const floorUnits = apartments.filter((unit) => Number(unit.min_floor || unit.floor) === floor);
    const towers = [...new Set(floorUnits.map((unit) => unit.house?.identificator).filter(Boolean))];
    for (const tower of towers) {
      const candidates = floorUnits.filter((unit) => unit.house?.identificator === tower);
      let best = null;
      for (const unit of candidates) {
      const response = await fetch(`https://voltaskai.endover.ee/korter/krulli-10-${unit.number_num}/`, { redirect: 'follow' });
      if (!response.url.includes('/korter/')) continue;
      const parsed = extractLabels(await response.text(), floor);
        if (!parsed || (best && parsed.labels.length <= best.labels.length)) continue;
        best = { sourceUnit: String(unit.number_num), ...parsed };
      }
      if (best) {
        result[floor][tower] = best;
        console.log(`Floor ${floor}, tower ${tower}: ${best.labels.length} labels from unit ${best.sourceUnit}`);
      } else console.warn(`Floor ${floor}, tower ${tower}: no production labels found`);
    }
    if (!Object.keys(result[floor]).length) delete result[floor];
  }
  fs.writeFileSync(path.join(root, 'plan-labels.json'), `${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
