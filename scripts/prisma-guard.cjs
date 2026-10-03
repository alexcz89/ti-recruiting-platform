#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = path.join(PROJECT_ROOT, '.env');
const SCHEMA_ENV_FILE = path.join(PROJECT_ROOT, 'prisma', '.env');
const LOCAL_HOSTNAMES = new Set(['localhost', 'db', 'host.docker.internal']);
const PROTECTED_COMMANDS = new Set([
  'migrate dev',
  'migrate deploy',
  'migrate reset',
  'db push',
  'db execute',
]);

class GuardError extends Error {}

function parseEnvFile(contents) {
  const values = {};

  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line);
    if (!match) continue;

    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }

    values[match[1]] = value;
  }

  return values;
}

function loadPrismaEnvironment(baseEnvironment) {
  const environment = { ...baseEnvironment };

  if (!fs.existsSync(DEFAULT_ENV_FILE)) return environment;

  const fileValues = parseEnvFile(fs.readFileSync(DEFAULT_ENV_FILE, 'utf8'));
  for (const [key, value] of Object.entries(fileValues)) {
    if (environment[key] === undefined || environment[key] === '') {
      environment[key] = value;
    }
  }

  return environment;
}

function parseDatabaseUrl(value, variableName) {
  if (!value) {
    throw new GuardError(`${variableName} is required for protected database commands.`);
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new GuardError(`${variableName} must be a valid PostgreSQL URL.`);
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new GuardError(`${variableName} must use the PostgreSQL protocol.`);
  }

  if (!parsed.hostname) {
    throw new GuardError(`${variableName} must include a hostname.`);
  }

  return {
    hostname: parsed.hostname.toLowerCase(),
    port: parsed.port || '5432',
    database: decodeURIComponent(parsed.pathname.replace(/^\//u, '')),
  };
}

function isLoopback(hostname) {
  if (hostname === '::1' || hostname === '[::1]') return true;
  const match = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/u.exec(hostname);
  return Boolean(
    match && match.slice(1).every((segment) => Number(segment) >= 0 && Number(segment) <= 255),
  );
}

function isLocalHostname(hostname) {
  return LOCAL_HOSTNAMES.has(hostname) || isLoopback(hostname);
}

function isNeonHostname(hostname) {
  return hostname.endsWith('.neon.tech');
}

function getCommandName(args) {
  if (args[0] === 'migrate' && args[1]) return `migrate ${args[1]}`;
  if (args[0] === 'db' && args[1]) return `db ${args[1]}`;
  return args[0] || '';
}

function getOptionValue(args, optionName) {
  const exactIndex = args.indexOf(optionName);
  if (exactIndex >= 0) return args[exactIndex + 1];

  const prefix = `${optionName}=`;
  const inline = args.find((arg) => arg.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

function hasOption(args, optionName) {
  return args.some((arg) => arg === optionName || arg.startsWith(`${optionName}=`));
}

function assertDefaultSchema(args) {
  if (!hasOption(args, '--schema')) return;

  const schemaOption = getOptionValue(args, '--schema');
  if (!schemaOption) {
    throw new GuardError('--schema requires a path.');
  }

  const requestedSchema = path.resolve(PROJECT_ROOT, schemaOption);
  const defaultSchema = path.join(PROJECT_ROOT, 'prisma', 'schema.prisma');
  const normalizeForComparison = (filePath) =>
    process.platform === 'win32' ? filePath.toLowerCase() : filePath;

  if (normalizeForComparison(requestedSchema) !== normalizeForComparison(defaultSchema)) {
    throw new GuardError(
      'Custom Prisma schemas are blocked because the guard cannot prove their datasource target.',
    );
  }
}

function assertNoSchemaEnvFile(schemaEnvFile = SCHEMA_ENV_FILE) {
  if (fs.existsSync(schemaEnvFile)) {
    throw new GuardError(
      'prisma/.env is blocked for protected commands because it can change the datasource after the guard runs. Move its values to the explicit process environment or root .env.',
    );
  }
}

function sameDestination(left, right) {
  return (
    left.hostname === right.hostname &&
    left.port === right.port &&
    left.database === right.database
  );
}

function hasExactRemoteAuthorization(
  environment,
  hostname,
  authorizationVariable = 'ALLOW_REMOTE_DB_MIGRATION',
) {
  const allowedHost = environment.ALLOWED_REMOTE_DB_HOST;
  return (
    environment[authorizationVariable] === 'true' &&
    typeof allowedHost === 'string' &&
    allowedHost.length > 0 &&
    !allowedHost.includes('*') &&
    allowedHost.toLowerCase() === hostname
  );
}

function evaluateConfiguredDatabaseTarget(
  environment,
  authorizationVariable = 'ALLOW_REMOTE_DB_MIGRATION',
) {
  assertNoSchemaEnvFile();

  const databaseTarget = parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL');
  const directTarget = environment.DIRECT_URL
    ? parseDatabaseUrl(environment.DIRECT_URL, 'DIRECT_URL')
    : undefined;
  const actualTarget = directTarget || databaseTarget;
  const targetsDiffer = Boolean(directTarget && !sameDestination(databaseTarget, directTarget));
  const configuredTargets = [databaseTarget, directTarget].filter(Boolean);
  const configuredRemoteTargets = configuredTargets.filter(
    (target) => !isLocalHostname(target.hostname),
  );
  const actualIsLocal = isLocalHostname(actualTarget.hostname);

  if (targetsDiffer && actualIsLocal && configuredRemoteTargets.length > 0) {
    throw new GuardError(
      'DATABASE_URL and DIRECT_URL point to different destinations, including an unused remote target. Refusing to continue.',
    );
  }

  if (targetsDiffer && actualIsLocal) {
    throw new GuardError(
      'DATABASE_URL and DIRECT_URL point to different local destinations. Refusing to choose silently.',
    );
  }

  if (!actualIsLocal) {
    if (
      !hasExactRemoteAuthorization(
        environment,
        actualTarget.hostname,
        authorizationVariable,
      )
    ) {
      const remoteKind = isNeonHostname(actualTarget.hostname) ? 'Neon ' : '';
      throw new GuardError(
        `Blocked remote ${remoteKind}database command for host "${actualTarget.hostname}". Set ${authorizationVariable}=true and ALLOWED_REMOTE_DB_HOST to this exact hostname to authorize it.`,
      );
    }
  } else if (configuredRemoteTargets.length > 0) {
    throw new GuardError(
      'A remote database URL is configured even though Prisma would use a local target. Refusing this ambiguous configuration.',
    );
  }

  return {
    hostname: actualTarget.hostname,
    targetKind: actualIsLocal ? 'local' : 'authorized remote',
  };
}

function evaluateRuntimeDatabaseTarget(
  environment,
  authorizationVariable = 'ALLOW_REMOTE_DATA_RECONCILIATION',
) {
  assertNoSchemaEnvFile();
  const actualTarget = parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL');
  const actualIsLocal = isLocalHostname(actualTarget.hostname);

  if (
    !actualIsLocal &&
    !hasExactRemoteAuthorization(
      environment,
      actualTarget.hostname,
      authorizationVariable,
    )
  ) {
    const remoteKind = isNeonHostname(actualTarget.hostname) ? 'Neon ' : '';
    throw new GuardError(
      `Blocked remote ${remoteKind}database command for host "${actualTarget.hostname}". Set ${authorizationVariable}=true and ALLOWED_REMOTE_DB_HOST to this exact hostname to authorize it.`,
    );
  }

  return {
    hostname: actualTarget.hostname,
    targetKind: actualIsLocal ? 'local' : 'authorized remote',
  };
}

function evaluatePrismaCommand(args, environment) {
  const commandName = getCommandName(args);
  if (!PROTECTED_COMMANDS.has(commandName)) {
    return { protected: false, commandName };
  }

  assertDefaultSchema(args);

  const explicitUrl = getOptionValue(args, '--url');
  if (hasOption(args, '--url') && commandName !== 'db execute') {
    throw new GuardError('--url is only supported by the guarded db execute command.');
  }

  if (commandName === 'db execute' && explicitUrl) {
    const actualTarget = parseDatabaseUrl(explicitUrl, '--url');
    const actualIsLocal = isLocalHostname(actualTarget.hostname);

    if (!actualIsLocal && !hasExactRemoteAuthorization(environment, actualTarget.hostname)) {
      const remoteKind = isNeonHostname(actualTarget.hostname) ? 'Neon ' : '';
      throw new GuardError(
        `Blocked remote ${remoteKind}database command for host "${actualTarget.hostname}". Set ALLOW_REMOTE_DB_MIGRATION=true and ALLOWED_REMOTE_DB_HOST to this exact hostname to authorize it.`,
      );
    }

    return {
      protected: true,
      commandName,
      hostname: actualTarget.hostname,
      targetKind: actualIsLocal ? 'local' : 'authorized remote',
    };
  }

  const target = evaluateConfiguredDatabaseTarget(environment);

  return {
    protected: true,
    commandName,
    ...target,
  };
}

function evaluateTestDatabase(environment) {
  if (!Object.prototype.hasOwnProperty.call(environment, 'DATABASE_URL') || !environment.DATABASE_URL) {
    throw new GuardError(
      'Database tests require an explicit local DATABASE_URL; .env fallback is disabled.',
    );
  }

  const databaseTarget = parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL');
  if (!isLocalHostname(databaseTarget.hostname)) {
    throw new GuardError('Database tests require DATABASE_URL to use local PostgreSQL/Docker.');
  }

  if (environment.DIRECT_URL) {
    const directTarget = parseDatabaseUrl(environment.DIRECT_URL, 'DIRECT_URL');
    if (!isLocalHostname(directTarget.hostname)) {
      throw new GuardError('Database tests cannot use a remote DIRECT_URL.');
    }
    if (!sameDestination(databaseTarget, directTarget)) {
      throw new GuardError(
        'Database tests require DATABASE_URL and DIRECT_URL to use the same local destination.',
      );
    }
  }

  return { hostname: databaseTarget.hostname };
}

function runCommand(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    env: environment,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error('Failed to start the guarded command.');
    return 1;
  }

  return result.status ?? 1;
}

function buildReconciliationCommand(args) {
  const tsxCli = path.join(PROJECT_ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const reconciliationScript = path.join(
    PROJECT_ROOT,
    'scripts',
    'reconcile-application-state.ts',
  );
  return {
    command: process.execPath,
    args: [tsxCli, reconciliationScript, ...args],
  };
}

function parseReconciliationArguments(args) {
  const separatorIndex = args.indexOf('--');
  if (separatorIndex === -1) {
    if (args.length > 1) {
      throw new GuardError(
        'Reconciliation arguments must follow the -- separator.',
      );
    }
    return [];
  }
  if (separatorIndex !== 1) {
    throw new GuardError(
      'Unexpected arguments before the reconciliation -- separator.',
    );
  }
  return args.slice(separatorIndex + 1);
}

function main() {
  const rawArgs = process.argv.slice(2);
  const checkOnly = rawArgs[0] === '--check';
  const args = checkOnly ? rawArgs.slice(1) : rawArgs;

  try {
    if (args[0] === 'reconcile-applications') {
      const reconciliationArgs = parseReconciliationArguments(args);
      const environment = loadPrismaEnvironment(process.env);
      const result = evaluateRuntimeDatabaseTarget(
        environment,
        'ALLOW_REMOTE_DATA_RECONCILIATION',
      );
      console.log(
        `Guard allowed application reconciliation for ${result.targetKind} host "${result.hostname}".`,
      );

      if (checkOnly) return 0;
      const command = buildReconciliationCommand(reconciliationArgs);
      return runCommand(
        command.command,
        command.args,
        environment,
      );
    }

    if (args[0] === 'test-db') {
      const separatorIndex = args.indexOf('--');
      const testCommand = separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];
      const result = evaluateTestDatabase(process.env);
      console.log(`Guard allowed database tests for local host "${result.hostname}".`);

      if (checkOnly || testCommand.length === 0) return 0;
      return runCommand(testCommand[0], testCommand.slice(1), process.env);
    }

    if (args.length === 0) {
      throw new GuardError('A Prisma command is required.');
    }

    const environment = loadPrismaEnvironment(process.env);
    const result = evaluatePrismaCommand(args, environment);

    if (result.protected) {
      console.log(
        `Guard allowed Prisma command "${result.commandName}" for ${result.targetKind} host "${result.hostname}".`,
      );
    } else if (checkOnly) {
      console.log(`Prisma command "${result.commandName}" does not require the database guard.`);
    }

    if (checkOnly) return 0;

    const prismaCli = path.join(PROJECT_ROOT, 'node_modules', 'prisma', 'build', 'index.js');
    if (!fs.existsSync(prismaCli)) {
      throw new GuardError('Prisma CLI is not installed. Run npm install first.');
    }

    return runCommand(process.execPath, [prismaCli, ...args], environment);
  } catch (error) {
    if (error instanceof GuardError) {
      console.error(`Prisma guard: ${error.message}`);
      return 1;
    }

    console.error('Prisma guard failed safely before running Prisma.');
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  assertNoSchemaEnvFile,
  buildReconciliationCommand,
  evaluateConfiguredDatabaseTarget,
  evaluateRuntimeDatabaseTarget,
  evaluatePrismaCommand,
  evaluateTestDatabase,
  getCommandName,
  hasOption,
  hasExactRemoteAuthorization,
  isLocalHostname,
  isNeonHostname,
  loadPrismaEnvironment,
  parseDatabaseUrl,
  parseEnvFile,
  parseReconciliationArguments,
};
