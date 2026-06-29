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
  init           Initialise astro-cloudflare-cms in the current project
  create-user    Create a user (author by default)
  list-users     List all users
  delete-user    Delete a user by email
  set-password   Reset a user's password by email

User-command options:
  --email <e>        Target email (or ACC_USER_EMAIL env)
  --name <n>         Display name (create-user; default = email local part)
  --role <r>         author | master (create-user; default author)
  --password <p>     Password (or ACC_USER_PASSWORD env; min 8 chars)
  --generate         Generate a random password and print it once
  --db-name <n>      D1 database name (default: read from wrangler config)
  --local            Target the local (miniflare) D1 instead of remote
  --json             list-users: output JSON
  --yes              Non-interactive (no prompts / skip confirmation)

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
} else if (cmd === 'create-user' || cmd === 'list-users' || cmd === 'delete-user' || cmd === 'set-password') {
  const m = await import('../src/cli/users-commands.mjs');
  if (cmd === 'create-user') await m.createUser(flags);
  else if (cmd === 'list-users') await m.listUsers(flags);
  else if (cmd === 'delete-user') await m.deleteUser(flags);
  else await m.setPassword(flags);
} else {
  process.stderr.write(USAGE);
  process.exit(1);
}
