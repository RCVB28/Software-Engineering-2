import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = path.join(root, 'apps', 'backend');
const frontendDir = path.join(root, 'apps', 'frontend');
const dataDir = path.join(root, '.devdb');
const port = Number(process.env.DEV_DB_PORT ?? 5433);
const database = process.env.DEV_DB_NAME ?? 'se2';
const databaseUrl = `postgresql://postgres:postgres@localhost:${port}/${database}?schema=public`;
const childEnv = { ...process.env, DATABASE_URL: databaseUrl };

const children = [];
let postgres = null;
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[dev] ${message}\n`);
}

function killTree(child) {
  if (!child.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) killTree(child);
  if (postgres) {
    try {
      await postgres.stop();
    } catch {
      // Already stopped.
    }
  }
  process.exit(code);
}

function run(command, cwd) {
  const result = spawnSync(command, {
    cwd,
    env: childEnv,
    stdio: 'inherit',
    shell: true
  });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${command}`);
  }
}

function startProcess(name, cwd) {
  const child = spawn('npm run dev', {
    cwd,
    env: childEnv,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const prefix = `[${name}] `;
  const forward = (stream, target) => {
    stream.on('data', (chunk) => {
      const text = chunk.toString();
      for (const line of text.split(/\r?\n/)) {
        if (line.length > 0) target.write(`${prefix}${line}\n`);
      }
    });
  };
  forward(child.stdout, process.stdout);
  forward(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      log(`${name} exited with code ${code ?? 'unknown'}; shutting down.`);
      void shutdown(code ?? 1);
    }
  });
  children.push(child);
}

async function main() {
  postgres = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: true,
    autoRehydrateSymlinks: true
  });

  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) {
    log(`Initializing PostgreSQL data directory at ${dataDir}`);
    await postgres.initialise();
  }

  log(`Starting PostgreSQL on port ${port}`);
  await postgres.start();

  try {
    await postgres.createDatabase(database);
    log(`Created database ${database}`);
  } catch {
    log(`Using existing database ${database}`);
  }

  log('Applying migrations and seed data');
  run('npx prisma migrate deploy', backendDir);
  run('npx prisma db seed', backendDir);

  startProcess('api', backendDir);
  startProcess('web', frontendDir);

  log('Ready: API http://localhost:4000 · Web http://localhost:5173');
  log('Press Ctrl+C to stop the API, web app, and database.');
}

process.on('SIGINT', () => void shutdown(0));
process.on('SIGTERM', () => void shutdown(0));

main().catch((error) => {
  console.error(`[dev] ${error instanceof Error ? error.message : error}`);
  void shutdown(1);
});
