import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';

/**
 * Run a shell command synchronously.
 * @param {string} cmd
 * @param {string[]} args
 * @param {{ cwd?: string, capture?: boolean }} [opts]
 * @returns {{ status: number | null, stdout: string }}
 */
export function run(cmd, args = [], opts = {}) {
  const { cwd, capture = false } = opts;
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: capture ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: capture ? (result.stdout ?? '') : '',
  };
}

export function log(msg) {
  console.log(msg);
}

export function warn(msg) {
  console.warn(msg);
}

export function die(msg) {
  console.error(msg);
  process.exit(1);
}

/**
 * Prompt the user for input via readline.
 * @param {string} question
 * @returns {Promise<string>}
 */
export function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
