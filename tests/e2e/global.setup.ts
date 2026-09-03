import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The suite asserts on exact counts and on a fresh personal workspace per
 * identity, so it starts from an empty database.
 */
export default function globalSetup() {
  const envFile = path.resolve(process.cwd(), '.env.local');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separator = trimmed.indexOf('=');
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator);
      if (process.env[key] === undefined) process.env[key] = trimmed.slice(separator + 1);
    }
  }
  execFileSync('pnpm', ['db:reset'], { stdio: 'inherit' });
}
