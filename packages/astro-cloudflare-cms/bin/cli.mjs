#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function readVersion() {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  return pkg.version;
}

function parseArgv(argv) {
  const args = argv.slice(2);
  const _ = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (a.startsWith('-') && a.length === 2) {
      flags[a.slice(1)] = true;
    } else {
      _.push(a);
    }
  }
  return { _, flags };
}

const USAGE = `\
Usage: astro-cloudflare-cms <command> [options]

Commands:
  init          Initialise astro-cloudflare-cms in the current project

Options:
  --help, -h    Show this help message
  --version     Print the version number
`;

const { _, flags } = parseArgv(process.argv);
const cmd = _[0];

if (flags.help || flags.h) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (flags.version) {
  process.stdout.write(readVersion() + '\n');
  process.exit(0);
}

if (cmd === 'init') {
  const { init } = await import('../src/cli/init.mjs');
  await init(flags);
} else {
  process.stderr.write(USAGE);
  process.exit(1);
}
