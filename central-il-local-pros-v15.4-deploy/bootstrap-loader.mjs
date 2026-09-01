import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const base = 'https://raw.githubusercontent.com/rhovel89/skylightreflectionsmarketing/central-il-local-pros-v15-4-deploy/central-il-local-pros-v15.4-deploy/source';
const names = ['chunk_00.txt','chunk_01.txt','chunk_02.txt','chunk_03a.txt','chunk_03b.txt','chunk_04.txt','chunk_05.txt'];
const parts = await Promise.all(names.map(async (name) => {
  const url = `${base}/${name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return (await response.text()).trim();
}));
const payload = JSON.parse(zlib.gunzipSync(Buffer.from(parts.join(''), 'base64')).toString('utf8'));
let restored = 0;
for (const [file, entry] of Object.entries(payload)) {
  if (!entry || typeof entry !== 'object' || entry.t !== 'u' || typeof entry.d !== 'string') throw new Error(`Invalid canonical entry: ${file}`);
  const target = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, entry.d, 'utf8');
  restored += 1;
}
console.log(`Restored ${restored} canonical V15.4 source files.`);
