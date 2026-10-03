import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const guardPath = path.resolve(process.cwd(), 'scripts/prisma-guard.cjs');
const require = createRequire(import.meta.url);
const {
  assertNoSchemaEnvFile,
  buildReconciliationCommand,
  parseReconciliationArguments,
} = require(guardPath) as {
  assertNoSchemaEnvFile: (schemaEnvFile?: string) => void;
  buildReconciliationCommand: (args: string[]) => {
    command: string;
    args: string[];
  };
  parseReconciliationArguments: (args: string[]) => string[];
};
const localUrl = 'postgresql://postgres:postgres@localhost:5432/taskio_test';
const loopbackUrl = 'postgresql://postgres:postgres@127.0.0.1:5432/taskio_test';
const dockerUrl = 'postgresql://postgres:postgres@db:5432/taskio_test';
const neonHost = 'ep-example.us-east-1.aws.neon.tech';
const neonPoolerHost = 'ep-example-pooler.us-east-1.aws.neon.tech';
const neonUrl = `postgresql://owner:password@${neonHost}/neondb`;
const neonPoolerUrl = `postgresql://owner:password@${neonPoolerHost}/neondb`;

function runGuard(
  args: string[],
  env: Record<string, string | undefined>,
) {
  const childEnv = { ...process.env };

  delete childEnv.DATABASE_URL;
  delete childEnv.DIRECT_URL;
  delete childEnv.ALLOW_REMOTE_DB_MIGRATION;
  delete childEnv.ALLOW_REMOTE_DATA_RECONCILIATION;
  delete childEnv.ALLOWED_REMOTE_DB_HOST;

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = value;
    }
  }

  return spawnSync(process.execPath, [guardPath, '--check', ...args], {
    cwd: process.cwd(),
    env: childEnv,
    encoding: 'utf8',
  });
}

describe('Prisma database command guard', () => {
  it('blocks a Neon migration before Prisma can open a connection', () => {
    const secret = 'never-print-this-password';
    const result = runGuard(['migrate', 'deploy'], {
      NODE_ENV: 'test',
      DATABASE_URL: `postgresql://owner:${secret}@ep-example-pooler.us-east-1.aws.neon.tech/neondb`,
      DIRECT_URL: `postgresql://owner:${secret}@ep-example.us-east-1.aws.neon.tech/neondb`,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Blocked remote Neon database command');
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it.each([
    ['localhost', localUrl],
    ['127.0.0.1', loopbackUrl],
    ['the Docker Compose database hostname', dockerUrl],
  ])('allows PostgreSQL on %s', (_label, url) => {
    const result = runGuard(['db', 'push'], {
      NODE_ENV: 'test',
      DATABASE_URL: url,
      DIRECT_URL: url,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('local host');
  });

  it('blocks a pooled Neon hostname by default', () => {
    const result = runGuard(['db', 'push'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonPoolerUrl,
      DIRECT_URL: neonPoolerUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Blocked remote Neon database command');
    expect(result.stderr).toContain(neonPoolerHost);
  });

  it('still blocks remote access with only ALLOW_REMOTE_DB_MIGRATION', () => {
    const result = runGuard(['migrate', 'dev'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
    });

    expect(result.status).toBe(1);
  });

  it('still blocks remote access with only ALLOWED_REMOTE_DB_HOST', () => {
    const result = runGuard(['migrate', 'deploy'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });

    expect(result.status).toBe(1);
  });

  it('allows an exact remote hostname when both authorization variables are correct', () => {
    const result = runGuard(['migrate', 'deploy'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonPoolerUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('authorized remote host');
    expect(result.stdout).toContain(neonHost);
  });

  it('blocks an authorized hostname that does not exactly match the actual target', () => {
    const result = runGuard(['migrate', 'deploy'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
      ALLOWED_REMOTE_DB_HOST: `wrong.${neonHost}`,
    });

    expect(result.status).toBe(1);
  });

  it('does not accept wildcard authorization', () => {
    const result = runGuard(['migrate', 'deploy'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
      ALLOWED_REMOTE_DB_HOST: '*.neon.tech',
    });

    expect(result.status).toBe(1);
  });

  it('detects a remote DATABASE_URL', () => {
    const result = runGuard(['migrate', 'reset'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(neonHost);
  });

  it('detects a remote DIRECT_URL even when DATABASE_URL is local', () => {
    const result = runGuard(['migrate', 'dev'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: neonUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(neonHost);
  });

  it('does not silently allow local DATABASE_URL with remote DIRECT_URL', () => {
    const result = runGuard(['db', 'push'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: neonUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain('Guard allowed');
  });

  it('blocks different local DATABASE_URL and DIRECT_URL destinations', () => {
    const result = runGuard(['db', 'push'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: loopbackUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('different local destinations');
  });

  it('treats different PostgreSQL ports as different destinations', () => {
    const result = runGuard(['db', 'push'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: 'postgresql://postgres:postgres@localhost:6543/taskio_test',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('different local destinations');
  });

  it('guards db execute using its explicit --url target', () => {
    const blocked = runGuard(['db', 'execute', '--url', neonUrl, '--stdin'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });
    const allowed = runGuard(['db', 'execute', `--url=${neonUrl}`, '--stdin'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });

    expect(blocked.status).toBe(1);
    expect(allowed.status).toBe(0);
  });

  it('allows db execute with an explicit local --url and no database environment', () => {
    const result = runGuard(['db', 'execute', '--url', localUrl, '--stdin'], {
      NODE_ENV: 'test',
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('local host');
  });

  it('rejects a custom Prisma schema whose datasource cannot be proven', () => {
    const result = runGuard(['migrate', 'deploy', '--schema', 'other/schema.prisma'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Custom Prisma schemas are blocked');
  });

  it('allows the repository Prisma schema explicitly', () => {
    const result = runGuard(
      ['migrate', 'deploy', '--schema=prisma/schema.prisma'],
      {
        NODE_ENV: 'test',
        DATABASE_URL: localUrl,
        DIRECT_URL: localUrl,
      },
    );

    expect(result.status).toBe(0);
  });

  it('fails closed when a schema-adjacent Prisma env file exists', () => {
    const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'taskio-prisma-guard-'));
    const schemaEnvFile = path.join(tempDirectory, '.env');

    try {
      fs.writeFileSync(schemaEnvFile, `DIRECT_URL=${neonUrl}\n`, 'utf8');

      expect(() => assertNoSchemaEnvFile(schemaEnvFile)).toThrow(
        'prisma/.env is blocked for protected commands',
      );
    } finally {
      fs.rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('fails database tests without an explicit DATABASE_URL', () => {
    const result = runGuard(['test-db'], {
      NODE_ENV: 'test',
      DATABASE_URL: undefined,
      DIRECT_URL: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('explicit local DATABASE_URL');
  });

  it('blocks a remote DATABASE_URL for database tests', () => {
    const result = runGuard(['test-db'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('local PostgreSQL/Docker');
  });

  it('allows database tests with an explicit local DATABASE_URL', () => {
    const result = runGuard(['test-db'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('allowed database tests');
  });

  it('guards application reconciliation with a dedicated remote authorization', () => {
    const blocked = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
    });
    const allowed = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });

    expect(blocked.status).toBe(1);
    expect(blocked.stderr).toContain('Blocked remote Neon database command');
    expect(allowed.status).toBe(0);
    expect(allowed.stdout).toContain(
      'allowed application reconciliation for local host',
    );
  });

  it('does not accept migration authorization for remote reconciliation', () => {
    const result = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DB_MIGRATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Set ALLOW_REMOTE_DATA_RECONCILIATION=true',
    );
  });

  it('requires exact host authorization for remote reconciliation', () => {
    const result = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DATA_RECONCILIATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      'allowed application reconciliation for authorized remote host',
    );
  });

  it('authorizes the runtime DATABASE_URL host instead of DIRECT_URL', () => {
    const authorizedDirectHostOnly = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonPoolerUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DATA_RECONCILIATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonHost,
    });
    const authorizedRuntimeHost = runGuard(['reconcile-applications'], {
      NODE_ENV: 'test',
      DATABASE_URL: neonPoolerUrl,
      DIRECT_URL: neonUrl,
      ALLOW_REMOTE_DATA_RECONCILIATION: 'true',
      ALLOWED_REMOTE_DB_HOST: neonPoolerHost,
    });

    expect(authorizedDirectHostOnly.status).toBe(1);
    expect(authorizedDirectHostOnly.stderr).toContain(neonPoolerHost);
    expect(authorizedRuntimeHost.status).toBe(0);
    expect(authorizedRuntimeHost.stdout).toContain(neonPoolerHost);
  });

  it('builds the fixed reconciliation command and forwards only its arguments', () => {
    const forwarded = parseReconciliationArguments([
      'reconcile-applications',
      '--',
      '--apply',
      '--global',
    ]);
    const command = buildReconciliationCommand(forwarded);

    expect(command.command).toBe(process.execPath);
    expect(command.args[0]).toMatch(/node_modules[\\/]tsx[\\/]dist[\\/]cli\.mjs$/);
    expect(command.args[1]).toMatch(
      /scripts[\\/]reconcile-application-state\.ts$/,
    );
    expect(command.args.slice(2)).toEqual(['--apply', '--global']);
  });

  it('rejects reconciliation arguments that omit the separator', () => {
    const result = runGuard(['reconcile-applications', '--apply', '--global'], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must follow the -- separator');
  });

  it('wires the real PostgreSQL hiring-process suite through test-db', () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };

    expect(packageJson.scripts['test:hiring-process:db']).toContain(
      'prisma-guard.cjs test-db --',
    );
    expect(packageJson.scripts['hiring-process:reconcile']).toContain(
      'prisma-guard.cjs reconcile-applications --',
    );
  });

  it.each(['generate', 'validate'])('does not unnecessarily guard prisma %s', (command) => {
    const result = runGuard([command], {
      NODE_ENV: 'test',
      DATABASE_URL: localUrl,
      DIRECT_URL: localUrl,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('does not require the database guard');
  });
});
