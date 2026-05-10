import { execSync } from 'child_process';

function docker(args: string[]) {
  const cmd = ['docker', ...args].join(' ');
  console.log(`> ${cmd}`);
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch {
    // Ignore errors (e.g., volume already removed)
  }
}

// Remove the named volume used by the E2E compose setup
docker(['volume', 'rm', 'hermes-e2e-data']);

// Recreate it so the next `docker compose up` has a clean slate
docker(['volume', 'create', 'hermes-e2e-data']);

console.log('[reset-e2e] Volume hermes-e2e-data reset successfully');
