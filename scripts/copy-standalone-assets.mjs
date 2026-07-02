import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const copies = [
  ['.next/static', '.next/standalone/.next/static'],
  ['public', '.next/standalone/public'],
];

for (const [from, to] of copies) {
  if (!existsSync(from)) continue;
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, force: true });
}
