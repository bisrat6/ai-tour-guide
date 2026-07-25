import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json');
const pkg: { version?: string } = JSON.parse(readFileSync(pkgPath, 'utf-8'));

export const appVersion = pkg.version ?? '0.0.0';
