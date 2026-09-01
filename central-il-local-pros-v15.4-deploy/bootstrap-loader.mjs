import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const base = 'https://raw.githubusercontent.com/rhovel89/skylightreflectionsmarketing/central-il-local-pros-v15-4-deploy/central-il-local-pros-v15.4-deploy/source';
const urls = Array.from({ length: 6 }, (_, i) => `${base}/chunk_${String(i).padStart(2, '0')}.txt`);
const parts = await Promise.all(urls.map(async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.text()).trim();
}));
const files = JSON.parse(zlib.gunzipSync(Buffer.from(parts.join(''), 'base64')).toString('utf8'));
for (const [file, data] of Object.entries(files)) {
  const target = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data, 'utf8');
}
console.log(`Restored ${Object.keys(files).length} canonical V15.4 source files.`);
