import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const isWindows = process.platform === 'win32';
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'));

const children = [
  start('api', 'src/server.ts'),
  start('worker', 'src/worker.ts'),
];

let shuttingDown = false;

function start(label, entrypoint) {
  const child = spawn(process.execPath, [tsxCli, 'watch', '--clear-screen=false', entrypoint], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.log(`[${label}] exited with ${signal || code}`);
      shutdown(code || 1);
    }
  });

  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(isWindows ? undefined : 'SIGTERM');
    }
  }

  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
